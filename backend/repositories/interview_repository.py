import sqlite3
import os
import json
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Generator
from backend.utils.logging import logger

DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "see_speak.db")

class InterviewRepository:
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
        """Initializes tables for interview sessions and evaluation results."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS interview_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT DEFAULT 'default_user',
                    interview_type TEXT NOT NULL,
                    language TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    duration_seconds INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'in_progress',
                    transcript TEXT DEFAULT '[]',
                    questions TEXT DEFAULT '[]',
                    answers TEXT DEFAULT '[]',
                    evaluation TEXT DEFAULT '{}',
                    experience_metrics TEXT DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_interview_user ON interview_sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_interview_status ON interview_sessions(status);
            """)

    def create_session(
        self,
        interview_type: str = "Technical Software Engineer",
        language: str = "en",
        user_id: str = "default_user",
        experience_metrics: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        session_id = f"intv_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        metrics_json = json.dumps(experience_metrics or {})
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO interview_sessions (
                    id, user_id, interview_type, language,
                    started_at, status, transcript, questions, answers,
                    evaluation, experience_metrics, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'in_progress', '[]', '[]', '[]', '{}', ?, ?, ?)
                """,
                (session_id, user_id, interview_type, language, now, metrics_json, now, now)
            )
        logger.info(f"Created interview session: {session_id} ({interview_type}, {language})")
        return self.get_session(session_id)

    def get_session(self, session_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute("SELECT * FROM interview_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
            else:
                cursor.execute("SELECT * FROM interview_sessions WHERE id = ?", (session_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return self._format_row(row)

    def list_sessions(self, user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    "SELECT * FROM interview_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                    (user_id, limit)
                )
            else:
                cursor.execute(
                    "SELECT * FROM interview_sessions ORDER BY created_at DESC LIMIT ?",
                    (limit,)
                )
            return [self._format_row(row) for row in cursor.fetchall()]

    def update_transcript(
        self,
        session_id: str,
        transcript_turns: List[Dict[str, Any]],
        experience_metrics: Optional[Dict[str, Any]] = None
    ) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            if experience_metrics:
                conn.execute(
                    """
                    UPDATE interview_sessions
                    SET transcript = ?, experience_metrics = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (json.dumps(transcript_turns), json.dumps(experience_metrics), now, session_id)
                )
            else:
                conn.execute(
                    """
                    UPDATE interview_sessions
                    SET transcript = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (json.dumps(transcript_turns), now, session_id)
                )
        return True

    def complete_session(
        self,
        session_id: str,
        evaluation: Dict[str, Any],
        duration_seconds: Optional[int] = None,
        experience_metrics: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc).isoformat()
        existing = self.get_session(session_id)
        if not existing:
            return None

        # Parse questions and answers from transcript
        transcript = existing.get("transcript", [])
        questions = [turn["text"] for turn in transcript if turn.get("speaker") in ["ai", "agent"]]
        answers = [turn["text"] for turn in transcript if turn.get("speaker") == "user"]

        dur = duration_seconds
        if dur is None:
            started = datetime.fromisoformat(existing["started_at"])
            completed = datetime.now(timezone.utc)
            dur = max(1, int((completed - started).total_seconds()))

        # Ensure evaluation contains both scores and performance_metrics
        if isinstance(evaluation, dict):
            scores = evaluation.get("scores") or evaluation.get("performance_metrics") or {}
            evaluation["scores"] = scores
            evaluation["performance_metrics"] = scores

        with self._get_connection() as conn:
            conn.execute(
                """
                UPDATE interview_sessions
                SET status = 'completed',
                    completed_at = ?,
                    duration_seconds = ?,
                    questions = ?,
                    answers = ?,
                    evaluation = ?,
                    experience_metrics = COALESCE(?, experience_metrics),
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    now,
                    dur,
                    json.dumps(questions),
                    json.dumps(answers),
                    json.dumps(evaluation),
                    json.dumps(experience_metrics) if experience_metrics else None,
                    now,
                    session_id
                )
            )
        logger.info(f"Completed interview session: {session_id} with duration={dur}s")
        return self.get_session(session_id)

    def _format_row(self, row: sqlite3.Row) -> Dict[str, Any]:
        data = dict(row)
        for key in ["transcript", "questions", "answers", "evaluation", "experience_metrics"]:
            if key in data and isinstance(data[key], str):
                try:
                    data[key] = json.loads(data[key])
                except Exception:
                    data[key] = [] if key in ["transcript", "questions", "answers"] else {}
        data["duration"] = data.get("duration_seconds")

        # Expose experience_metrics top-level fields for easy consumption
        exp_metrics = data.get("experience_metrics")
        if isinstance(exp_metrics, dict):
            for k, v in exp_metrics.items():
                if k not in data:
                    data[k] = v

        # Ensure scores is available both at the root of the session and within evaluation
        eval_dict = data.get("evaluation") if isinstance(data.get("evaluation"), dict) else {}
        scores = eval_dict.get("scores") or eval_dict.get("performance_metrics") or {}
        data["scores"] = scores
        if isinstance(data.get("evaluation"), dict):
            data["evaluation"]["scores"] = scores
            data["evaluation"]["performance_metrics"] = scores

        return data

interview_repository = InterviewRepository()
