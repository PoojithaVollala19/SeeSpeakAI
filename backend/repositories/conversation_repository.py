import sqlite3
import os
import json
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Generator
from backend.utils.logging import logger

DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "see_speak.db")

FEATURE_MAPPING = {
    "document": "document-analysis",
    "document-analysis": "document-analysis",
    "vision": "visual-intelligence",
    "visual-intelligence": "visual-intelligence",
    "interview": "ai-interview",
    "ai-interview": "ai-interview",
    "support": "customer-support",
    "customer-support": "customer-support",
    "customer-service": "customer-support",
    "meeting": "video-audio-review",
    "video-audio-review": "video-audio-review",
    "study": "data-study",
    "data-study": "data-study",
}

def normalize_feature_id(feature: Optional[str]) -> str:
    """Normalizes any feature string or alias to the canonical feature ID."""
    if not feature:
        return "document-analysis"
    f_clean = feature.lower().strip()
    return FEATURE_MAPPING.get(f_clean, f_clean)

class ConversationRepository:
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
        """Initializes and migrates SQLite tables for conversations, messages, and files."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    feature TEXT NOT NULL,
                    mode TEXT DEFAULT 'general',
                    language TEXT DEFAULT 'en',
                    is_favorite INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS conversation_files (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    feature_id TEXT DEFAULT '',
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    size_bytes INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
                CREATE INDEX IF NOT EXISTS idx_files_conv ON conversation_files(conversation_id);
                CREATE INDEX IF NOT EXISTS idx_conv_feature ON conversations(feature);
            """)

            # Schema migration check: ensure conversation_files has feature_id column
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(conversation_files)")
            file_columns = [row["name"] for row in cursor.fetchall()]
            if "feature_id" not in file_columns:
                cursor.execute("ALTER TABLE conversation_files ADD COLUMN feature_id TEXT DEFAULT ''")
                logger.info("Migrated conversation_files: added feature_id column")

            # Schema migration check: ensure conversations has is_favorite column
            cursor.execute("PRAGMA table_info(conversations)")
            conv_columns = [row["name"] for row in cursor.fetchall()]
            if "is_favorite" not in conv_columns:
                cursor.execute("ALTER TABLE conversations ADD COLUMN is_favorite INTEGER DEFAULT 0")
                logger.info("Migrated conversations: added is_favorite column")

            # Schema migration check: ensure conversations has ticket_id and summary_json
            if "ticket_id" not in conv_columns:
                cursor.execute("ALTER TABLE conversations ADD COLUMN ticket_id TEXT DEFAULT ''")
                logger.info("Migrated conversations: added ticket_id column")
            if "summary_json" not in conv_columns:
                cursor.execute("ALTER TABLE conversations ADD COLUMN summary_json TEXT DEFAULT ''")
                logger.info("Migrated conversations: added summary_json column")

            # Schema migration check: ensure conversations has user_id column
            if "user_id" not in conv_columns:
                cursor.execute("ALTER TABLE conversations ADD COLUMN user_id TEXT DEFAULT ''")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id)")
                logger.info("Migrated conversations: added user_id column and index")

        logger.info(f"Initialized SQLite database at {self.db_path}")

    def create_conversation(
        self,
        feature: str = "document-analysis",
        mode: str = "general",
        language: str = "en",
        title: Optional[str] = None,
        ticket_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        conv_id = f"conv_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        canonical_feature = normalize_feature_id(feature)
        initial_title = title or "New Conversation"
        t_id = ticket_id or ""
        u_id = (user_id or "").strip()

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO conversations (id, title, feature, mode, language, is_favorite, ticket_id, user_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
                """,
                (conv_id, initial_title, canonical_feature, mode, language, t_id, u_id, now, now)
            )

        return {
            "id": conv_id,
            "feature_id": canonical_feature,
            "feature": canonical_feature,
            "title": initial_title,
            "mode": mode,
            "language": language,
            "is_favorite": False,
            "ticket_id": t_id,
            "user_id": u_id,
            "summary": None,
            "created_at": now,
            "updated_at": now,
            "messages": [],
            "files": []
        }

    def get_conversation(self, conv_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    "SELECT * FROM conversations WHERE id = ? AND (user_id = ? OR user_id = '' OR user_id = 'default_user' OR user_id IS NULL)",
                    (conv_id, user_id)
                )
            else:
                cursor.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,))
            row = cursor.fetchone()
            if not row:
                return None
            
            conv = dict(row)
            canonical_feature = normalize_feature_id(conv.get("feature"))
            conv["feature"] = canonical_feature
            conv["feature_id"] = canonical_feature
            conv["is_favorite"] = bool(conv.get("is_favorite", 0))
            conv["ticket_id"] = conv.get("ticket_id") or ""

            if conv.get("summary_json"):
                try:
                    conv["summary"] = json.loads(conv["summary_json"])
                except Exception:
                    conv["summary"] = None
            else:
                conv["summary"] = None

            # Fetch messages
            cursor.execute(
                "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
                (conv_id,)
            )
            conv["messages"] = [dict(r) for r in cursor.fetchall()]

            # Fetch files strictly for this conversation
            cursor.execute(
                "SELECT * FROM conversation_files WHERE conversation_id = ? ORDER BY created_at ASC",
                (conv_id,)
            )
            files = []
            for r in cursor.fetchall():
                f_dict = dict(r)
                f_dict["url"] = f"/uploads/{os.path.basename(f_dict.get('file_path', ''))}"
                files.append(f_dict)
            conv["files"] = files

            # Attach associated ticket if support feature or ticket_id exists
            if canonical_feature == "customer-support" or conv["ticket_id"]:
                try:
                    from backend.repositories.ticket_repository import ticket_repository
                    ticket = None
                    if conv["ticket_id"]:
                        ticket = ticket_repository.get_ticket(conv["ticket_id"])
                    if not ticket:
                        ticket = ticket_repository.get_ticket_by_conversation(conv_id)
                    if ticket:
                        conv["ticket"] = ticket
                        conv["ticket_id"] = ticket["id"]
                except Exception as e:
                    logger.warning(f"Could not load ticket for conv {conv_id}: {e}")

            return conv

    def save_summary(
        self,
        conv_id: str,
        summary_data: Dict[str, Any],
        ticket_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc).isoformat()
        summary_str = json.dumps(summary_data, ensure_ascii=False)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if ticket_id:
                cursor.execute(
                    "UPDATE conversations SET summary_json = ?, ticket_id = ?, updated_at = ? WHERE id = ?",
                    (summary_str, ticket_id, now, conv_id)
                )
            else:
                cursor.execute(
                    "UPDATE conversations SET summary_json = ?, updated_at = ? WHERE id = ?",
                    (summary_str, now, conv_id)
                )
        return self.get_conversation(conv_id)

    def update_conversation_ticket(self, conv_id: str, ticket_id: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE conversations SET ticket_id = ?, updated_at = ? WHERE id = ?",
                (ticket_id, now, conv_id)
            )

    def list_conversations(
        self,
        feature: Optional[str] = None,
        query: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Lists conversations. When feature is provided, strictly limits results
        to conversations belonging to that specific feature.
        When user_id is provided, strictly limits results to that authenticated user.
        """
        canonical_feature = normalize_feature_id(feature) if feature else None

        with self._get_connection() as conn:
            cursor = conn.cursor()
            conditions = []
            params = []

            if user_id:
                conditions.append("c.user_id = ?")
                params.append(user_id)
            elif user_id is not None:
                # Explicit unauthenticated or empty user
                conditions.append("(c.user_id = '' OR c.user_id = 'default_user' OR c.user_id IS NULL)")

            if canonical_feature and canonical_feature != "all":
                # Find matching feature or legacy alias
                aliases = [canonical_feature]
                for k, v in FEATURE_MAPPING.items():
                    if v == canonical_feature and k not in aliases:
                        aliases.append(k)
                placeholders = ",".join("?" for _ in aliases)
                conditions.append(f"c.feature IN ({placeholders})")
                params.extend(aliases)

            if query and query.strip():
                term = f"%{query.strip()}%"
                conditions.append("(c.title LIKE ? OR m.content LIKE ?)")
                params.extend([term, term])

            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

            sql = f"""
                SELECT DISTINCT c.* FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                {where_clause}
                ORDER BY c.updated_at DESC
                LIMIT 60
            """
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            result = []
            for r in rows:
                c = dict(r)
                c["feature"] = normalize_feature_id(c.get("feature"))
                c["feature_id"] = c["feature"]
                c["is_favorite"] = bool(c.get("is_favorite", 0))
                # Count files
                cur2 = conn.cursor()
                cur2.execute("SELECT COUNT(*) as count FROM conversation_files WHERE conversation_id = ?", (c["id"],))
                c["file_count"] = cur2.fetchone()["count"]
                result.append(c)
            return result

    def toggle_favorite(self, conv_id: str, is_favorite: Optional[bool] = None, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Toggles or sets the is_favorite state of a conversation and returns the updated state."""
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    "SELECT is_favorite FROM conversations WHERE id = ? AND (user_id = ? OR user_id = '' OR user_id IS NULL)",
                    (conv_id, user_id)
                )
            else:
                cursor.execute("SELECT is_favorite FROM conversations WHERE id = ?", (conv_id,))
            row = cursor.fetchone()
            if not row:
                return None
            
            current_val = bool(row["is_favorite"])
            new_val = not current_val if is_favorite is None else bool(is_favorite)
            new_int = 1 if new_val else 0

            if user_id:
                cursor.execute(
                    "UPDATE conversations SET is_favorite = ?, updated_at = ? WHERE id = ? AND (user_id = ? OR user_id = '' OR user_id IS NULL)",
                    (new_int, now, conv_id, user_id)
                )
            else:
                cursor.execute(
                    "UPDATE conversations SET is_favorite = ?, updated_at = ? WHERE id = ?",
                    (new_int, now, conv_id)
                )
            return {
                "id": conv_id,
                "is_favorite": new_val,
                "updated_at": now
            }

    def update_title(self, conv_id: str, new_title: str, user_id: Optional[str] = None) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND (user_id = ? OR user_id = '' OR user_id IS NULL)",
                    (new_title.strip()[:80], now, conv_id, user_id)
                )
            else:
                cursor.execute(
                    "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                    (new_title.strip()[:80], now, conv_id)
                )
            return cursor.rowcount > 0

    def delete_conversation(self, conv_id: str, user_id: Optional[str] = None) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    "DELETE FROM conversations WHERE id = ? AND (user_id = ? OR user_id = '' OR user_id IS NULL)",
                    (conv_id, user_id)
                )
            else:
                cursor.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
            return cursor.rowcount > 0

    def add_message(self, conv_id: str, role: str, content: str) -> Dict[str, Any]:
        msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO messages (id, conversation_id, role, content, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (msg_id, conv_id, role, content, now)
            )
            conn.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conv_id)
            )
        return {
            "id": msg_id,
            "conversation_id": conv_id,
            "role": role,
            "content": content,
            "created_at": now
        }

    def add_file(
        self,
        conv_id: str,
        filename: str,
        file_path: str,
        mime_type: str,
        size_bytes: int = 0,
        feature: Optional[str] = None
    ) -> Dict[str, Any]:
        file_id = f"file_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        canonical_feature = normalize_feature_id(feature)

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO conversation_files (id, conversation_id, feature_id, filename, file_path, mime_type, size_bytes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (file_id, conv_id, canonical_feature, filename, file_path, mime_type, size_bytes, now)
            )
            conn.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conv_id)
            )
        return {
            "id": file_id,
            "conversation_id": conv_id,
            "feature_id": canonical_feature,
            "filename": filename,
            "file_path": file_path,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
            "created_at": now
        }

    def generate_smart_title(
        self,
        conv_id: str,
        first_message: Optional[str] = None,
        filename: Optional[str] = None
    ) -> str:
        """Generates a concise title based on file name or user query."""
        if filename:
            clean_name = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ")
            title = f"{clean_name.title()} Analysis"[:50]
        elif first_message:
            words = first_message.strip().split()
            if len(words) <= 6:
                title = first_message.strip().capitalize()
            else:
                title = " ".join(words[:6]).capitalize() + "..."
            title = title[:50]
        else:
            title = "Conversation"

        self.update_title(conv_id, title)
        return title

    def get_file(self, file_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM conversation_files WHERE id = ?", (file_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def delete_file(self, file_id: str) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM conversation_files WHERE id = ?", (file_id,))
            return cursor.rowcount > 0

conversation_repository = ConversationRepository()
