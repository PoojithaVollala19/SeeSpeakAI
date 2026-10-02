import os
import sqlite3
import hashlib
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Generator
from contextlib import contextmanager
from backend.utils.logging import logger

DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "see_speak.db")

class UserRepository:
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
        """Initializes tables for users, sessions, and password reset tokens."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    password_salt TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS user_sessions (
                    token TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    expires_at TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS password_resets (
                    token TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    expires_at TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    used INTEGER DEFAULT 0
                );

                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);
            """)
        logger.info(f"[AUTH] User repository initialized at {self.db_path}")

    @staticmethod
    def _hash_password(password: str, salt: str) -> str:
        """Derives a cryptographically secure PBKDF2-HMAC-SHA256 hash."""
        return hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations=100000
        ).hex()

    def create_user(self, name: str, email: str, password: str) -> Dict[str, Any]:
        """Creates a new user with salted PBKDF2 hash. Raises ValueError if email exists."""
        clean_email = email.strip().lower()
        clean_name = name.strip()
        if not clean_email or "@" not in clean_email:
            raise ValueError("A valid email address is required.")
        if len(password) < 6:
            raise ValueError("Password must be at least 6 characters long.")
        if not clean_name:
            raise ValueError("Full name is required.")

        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        salt = secrets.token_hex(16)
        pw_hash = self._hash_password(password, salt)
        now = datetime.now(timezone.utc).isoformat()

        with self._get_connection() as conn:
            # Check existing email
            existing = conn.execute("SELECT id FROM users WHERE email = ?", (clean_email,)).fetchone()
            if existing:
                raise ValueError("An account with this email address already exists.")

            conn.execute("""
                INSERT INTO users (id, name, email, password_hash, password_salt, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (user_id, clean_name, clean_email, pw_hash, salt, now, now))

        logger.info(f"[AUTH] Created new user: {clean_email} ({user_id})")
        return {
            "id": user_id,
            "name": clean_name,
            "email": clean_email,
            "created_at": now
        }

    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Verifies email and password credentials. Returns user dict on success, None on failure."""
        clean_email = email.strip().lower()
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (clean_email,)).fetchone()
            if not row:
                return None

            expected_hash = row["password_hash"]
            salt = row["password_salt"]
            candidate_hash = self._hash_password(password, salt)

            # Constant-time comparison to prevent timing attacks
            if secrets.compare_digest(expected_hash, candidate_hash):
                return {
                    "id": row["id"],
                    "name": row["name"],
                    "email": row["email"],
                    "created_at": row["created_at"]
                }
        return None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT id, name, email, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
            if row:
                return dict(row)
        return None

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        with self._get_connection() as conn:
            row = conn.execute("SELECT id, name, email, created_at FROM users WHERE email = ?", (clean_email,)).fetchone()
            if row:
                return dict(row)
        return None

    def create_session(self, user_id: str, duration_days: int = 14) -> str:
        """Generates a secure session token and persists to SQLite."""
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        expires = now + timedelta(days=duration_days)

        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO user_sessions (token, user_id, expires_at, created_at)
                VALUES (?, ?, ?, ?)
            """, (token, user_id, expires.isoformat(), now.isoformat()))

        return token

    def get_user_by_session_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Returns user if token is valid and not expired; deletes expired sessions."""
        if not token:
            return None

        now_iso = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            # Query session join user
            row = conn.execute("""
                SELECT u.id, u.name, u.email, u.created_at, s.expires_at
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ?
            """, (token,)).fetchone()

            if not row:
                return None

            if row["expires_at"] < now_iso:
                # Expired session
                conn.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
                return None

            return {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"],
                "created_at": row["created_at"]
            }

    def delete_session(self, token: str) -> bool:
        """Removes a session token (logout)."""
        with self._get_connection() as conn:
            res = conn.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
            return res.rowcount > 0

    def create_password_reset(self, email: str) -> Optional[str]:
        """Creates a reset token valid for 2 hours."""
        clean_email = email.strip().lower()
        user = self.get_user_by_email(clean_email)
        if not user:
            return None

        token = secrets.token_urlsafe(24)
        now = datetime.now(timezone.utc)
        expires = now + timedelta(hours=2)

        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO password_resets (token, user_id, expires_at, created_at, used)
                VALUES (?, ?, ?, ?, 0)
            """, (token, user["id"], expires.isoformat(), now.isoformat()))

        logger.info(f"[AUTH] Generated password reset token for {clean_email}")
        return token

    def reset_password(self, token: str, new_password: str) -> bool:
        """Validates token and updates user password."""
        if len(new_password) < 6:
            raise ValueError("New password must be at least 6 characters.")

        now_iso = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            row = conn.execute("""
                SELECT user_id, expires_at, used
                FROM password_resets
                WHERE token = ?
            """, (token,)).fetchone()

            if not row or row["used"] == 1 or row["expires_at"] < now_iso:
                return False

            user_id = row["user_id"]
            salt = secrets.token_hex(16)
            pw_hash = self._hash_password(new_password, salt)

            # Update password
            conn.execute("""
                UPDATE users
                SET password_hash = ?, password_salt = ?, updated_at = ?
                WHERE id = ?
            """, (pw_hash, salt, now_iso, user_id))

            # Mark reset token as used
            conn.execute("UPDATE password_resets SET used = 1 WHERE token = ?", (token,))

            # Invalidate existing sessions for security
            conn.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))

        logger.info(f"[AUTH] Successfully reset password for user {user_id}")
        return True

user_repository = UserRepository()
