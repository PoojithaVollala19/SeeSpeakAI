import sqlite3
import os
import json
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Generator
from backend.utils.logging import logger

DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "see_speak.db")

class TicketRepository:
    def __init__(self, db_path: str = DB_FILE):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self):
        """Initializes tables for support tickets and ticket messages."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS support_tickets (
                    id TEXT PRIMARY KEY,
                    ticket_number TEXT UNIQUE NOT NULL,
                    user_id TEXT DEFAULT 'default_user',
                    subject TEXT NOT NULL,
                    description TEXT NOT NULL,
                    category TEXT DEFAULT 'Technical Support',
                    priority TEXT DEFAULT 'Medium',
                    status TEXT DEFAULT 'Open',
                    language TEXT DEFAULT 'en',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    resolved_at TEXT
                );

                CREATE TABLE IF NOT EXISTS ticket_messages (
                    id TEXT PRIMARY KEY,
                    ticket_id TEXT NOT NULL,
                    sender_type TEXT NOT NULL,
                    message TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    FOREIGN KEY(ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
                CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
                CREATE INDEX IF NOT EXISTS idx_ticket_messages_tid ON ticket_messages(ticket_id);
            """)

            # Schema migration check: ensure support_tickets has conversation_id and summary_json
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(support_tickets)")
            ticket_columns = [row["name"] for row in cursor.fetchall()]
            if "conversation_id" not in ticket_columns:
                cursor.execute("ALTER TABLE support_tickets ADD COLUMN conversation_id TEXT DEFAULT ''")
                logger.info("Migrated support_tickets: added conversation_id column")
            if "summary_json" not in ticket_columns:
                cursor.execute("ALTER TABLE support_tickets ADD COLUMN summary_json TEXT DEFAULT ''")
                logger.info("Migrated support_tickets: added summary_json column")

    def _generate_ticket_number(self, conn: sqlite3.Connection) -> str:
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(CAST(SUBSTR(ticket_number, 6) AS INTEGER)) as max_num FROM support_tickets WHERE ticket_number LIKE 'TICK-%'")
        row = cursor.fetchone()
        next_num = 1001 if (not row or row["max_num"] is None) else (row["max_num"] + 1)
        # Verify it doesn't already exist
        cursor.execute("SELECT 1 FROM support_tickets WHERE ticket_number = ?", (f"TICK-{next_num}",))
        if cursor.fetchone():
            return f"TICK-{next_num}-{uuid.uuid4().hex[:4].upper()}"
        return f"TICK-{next_num}"

    def create_ticket(
        self,
        subject: str,
        description: str,
        category: str = "Technical Support",
        priority: str = "Medium",
        language: str = "en",
        user_id: str = "default_user",
        initial_message: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        ticket_id = f"tck_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        conv_id = conversation_id or ""
        with self._get_connection() as conn:
            ticket_number = self._generate_ticket_number(conn)
            conn.execute(
                """
                INSERT INTO support_tickets (
                    id, ticket_number, user_id, subject, description,
                    category, priority, status, language, conversation_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?)
                """,
                (ticket_id, ticket_number, user_id, subject, description, category, priority, language, conv_id, now, now)
            )

            # Insert initial message
            msg_id = f"tmsg_{uuid.uuid4().hex[:12]}"
            msg_text = initial_message or description
            conn.execute(
                """
                INSERT INTO ticket_messages (id, ticket_id, sender_type, message, timestamp)
                VALUES (?, ?, 'user', ?, ?)
                """,
                (msg_id, ticket_id, msg_text, now)
            )

        logger.info(f"Created support ticket {ticket_number} ({ticket_id}) for conv {conv_id}")
        return self.get_ticket(ticket_id)

    def get_ticket(self, ticket_id_or_number: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    """
                    SELECT * FROM support_tickets
                    WHERE (id = ? OR ticket_number = ?) AND user_id = ?
                    """,
                    (ticket_id_or_number, ticket_id_or_number, user_id)
                )
            else:
                cursor.execute(
                    """
                    SELECT * FROM support_tickets
                    WHERE id = ? OR ticket_number = ?
                    """,
                    (ticket_id_or_number, ticket_id_or_number)
                )
            row = cursor.fetchone()
            if not row:
                return None

            ticket = dict(row)
            if ticket.get("summary_json"):
                try:
                    ticket["summary"] = json.loads(ticket["summary_json"])
                except Exception:
                    ticket["summary"] = None
            else:
                ticket["summary"] = None

            # Fetch messages
            cursor.execute(
                "SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY timestamp ASC",
                (ticket["id"],)
            )
            ticket["messages"] = [dict(r) for r in cursor.fetchall()]
            return ticket

    def get_ticket_by_conversation(self, conversation_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not conversation_id:
            return None
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    "SELECT id FROM support_tickets WHERE conversation_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1",
                    (conversation_id, user_id)
                )
            else:
                cursor.execute(
                    "SELECT id FROM support_tickets WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1",
                    (conversation_id,)
                )
            row = cursor.fetchone()
            if not row:
                return None
            return self.get_ticket(row["id"], user_id=user_id)

    def save_ticket_summary(
        self,
        ticket_id_or_number: str,
        summary_data: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc).isoformat()
        summary_str = json.dumps(summary_data, ensure_ascii=False)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    """
                    UPDATE support_tickets
                    SET summary_json = ?, status = 'Resolved', updated_at = ?, resolved_at = COALESCE(resolved_at, ?)
                    WHERE (id = ? OR ticket_number = ?) AND user_id = ?
                    """,
                    (summary_str, now, now, ticket_id_or_number, ticket_id_or_number, user_id)
                )
            else:
                cursor.execute(
                    """
                    UPDATE support_tickets
                    SET summary_json = ?, status = 'Resolved', updated_at = ?, resolved_at = COALESCE(resolved_at, ?)
                    WHERE id = ? OR ticket_number = ?
                    """,
                    (summary_str, now, now, ticket_id_or_number, ticket_id_or_number)
                )
            if cursor.rowcount == 0:
                return None
        return self.get_ticket(ticket_id_or_number, user_id=user_id)

    def list_tickets(
        self,
        user_id: Optional[str] = None,
        status: Optional[str] = None,
        category: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            conditions = []
            params = []

            if user_id:
                conditions.append("user_id = ?")
                params.append(user_id)
            if status and status.lower() != "all":
                conditions.append("LOWER(status) = LOWER(?)")
                params.append(status)
            if category and category.lower() != "all":
                conditions.append("LOWER(category) = LOWER(?)")
                params.append(category)
            if query:
                q_clean = f"%{query.strip()}%"
                conditions.append("(subject LIKE ? OR description LIKE ? OR ticket_number LIKE ?)")
                params.extend([q_clean, q_clean, q_clean])

            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            sql = f"SELECT * FROM support_tickets {where_clause} ORDER BY updated_at DESC LIMIT ?"
            params.append(limit)

            cursor.execute(sql, tuple(params))
            tickets = []
            for row in cursor.fetchall():
                t = dict(row)
                # Count messages
                cursor.execute("SELECT COUNT(*) as msg_count FROM ticket_messages WHERE ticket_id = ?", (t["id"],))
                t["message_count"] = cursor.fetchone()["msg_count"]
                tickets.append(t)
            return tickets

    def update_ticket_status(self, ticket_id_or_number: str, new_status: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        valid_statuses = ["Open", "In Progress", "Waiting for Customer", "Resolved", "Closed"]
        # Normalize status case
        matched_status = next((s for s in valid_statuses if s.lower() == new_status.lower()), None)
        if not matched_status:
            raise ValueError(f"Invalid status: {new_status}. Must be one of {valid_statuses}")

        now = datetime.now(timezone.utc).isoformat()
        resolved_at = now if matched_status in ["Resolved", "Closed"] else None

        with self._get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    """
                    UPDATE support_tickets
                    SET status = ?, updated_at = ?, resolved_at = COALESCE(?, resolved_at)
                    WHERE (id = ? OR ticket_number = ?) AND user_id = ?
                    """,
                    (matched_status, now, resolved_at, ticket_id_or_number, ticket_id_or_number, user_id)
                )
            else:
                cursor.execute(
                    """
                    UPDATE support_tickets
                    SET status = ?, updated_at = ?, resolved_at = COALESCE(?, resolved_at)
                    WHERE id = ? OR ticket_number = ?
                    """,
                    (matched_status, now, resolved_at, ticket_id_or_number, ticket_id_or_number)
                )

            if cursor.rowcount == 0:
                return None

            # Add system message noting the status update
            t = self.get_ticket(ticket_id_or_number, user_id=user_id)
            if t:
                msg_id = f"tmsg_{uuid.uuid4().hex[:12]}"
                conn.execute(
                    """
                    INSERT INTO ticket_messages (id, ticket_id, sender_type, message, timestamp)
                    VALUES (?, ?, 'system', ?, ?)
                    """,
                    (msg_id, t["id"], f"Ticket status updated to '{matched_status}'", now)
                )

        return self.get_ticket(ticket_id_or_number, user_id=user_id)

    def add_ticket_message(
        self,
        ticket_id_or_number: str,
        sender_type: str,
        message: str,
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        t = self.get_ticket(ticket_id_or_number, user_id=user_id)
        if not t:
            return None

        now = datetime.now(timezone.utc).isoformat()
        msg_id = f"tmsg_{uuid.uuid4().hex[:12]}"
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO ticket_messages (id, ticket_id, sender_type, message, timestamp)
                VALUES (?, ?, ?, ?, ?)
                """,
                (msg_id, t["id"], sender_type, message, now)
            )
            conn.execute(
                "UPDATE support_tickets SET updated_at = ? WHERE id = ?",
                (now, t["id"])
            )

        logger.info(f"Added message to ticket {t['ticket_number']} from {sender_type}")
        return self.get_ticket(t["id"])

    def get_ticket_context_prompt(self, ticket_id_or_number: str) -> str:
        """Constructs grounded context for AI Customer Service voice/text assistant."""
        t = self.get_ticket(ticket_id_or_number)
        if not t:
            return ""

        messages_text = ""
        for m in t.get("messages", [])[-6:]:
            messages_text += f"\n- [{m['sender_type'].upper()}] {m['message']}"

        return (
            f"\n\n### ACTIVE CUSTOMER SUPPORT TICKET CONTEXT:\n"
            f"- Ticket Number: {t['ticket_number']}\n"
            f"- Subject: {t['subject']}\n"
            f"- Category: {t['category']}\n"
            f"- Priority: {t['priority']}\n"
            f"- Current Status: {t['status']}\n"
            f"- Problem Description: {t['description']}\n"
            f"- Recent Ticket Discussion:{messages_text}\n"
            f"GUIDANCE: Assist the user specifically regarding this ticket issue with empathy and accuracy."
        )

ticket_repository = TicketRepository()
