import time
import uuid
from typing import Optional, Dict, Any, List
from backend.utils.logging import logger

class VoiceSession:
    def __init__(self, mode: str = "interviewer", conversation_id: Optional[str] = None):
        self.session_id: str = f"sess_{uuid.uuid4().hex[:12]}"
        self.mode: str = mode
        self.conversation_id: str = conversation_id or f"conv_{uuid.uuid4().hex[:12]}"
        self.state: str = "idle"  # idle, listening, agent_speaking
        self.user_speech_start_time: Optional[float] = None
        self.user_speech_end_time: Optional[float] = None
        self.agent_speech_start_time: Optional[float] = None
        self.last_latency_ms: Optional[int] = None
        self.transcript_history: List[Dict[str, Any]] = []

        # Turn aggregation buffers to guarantee paragraph-based conversation turns
        self._current_user_turn_text: str = ""
        self._current_agent_turn_text: str = ""
        self._user_turn_finalized: bool = True
        self._agent_turn_finalized: bool = True

    def on_user_speaking(self):
        """Called when user starts speaking or sends an audio packet after silence."""
        now = time.time()
        self.state = "listening"
        if self.user_speech_start_time is None:
            self.user_speech_start_time = now
        self.user_speech_end_time = now
        self._user_turn_finalized = False

    def on_user_silent(self):
        """Marks the end of user speech."""
        self.user_speech_end_time = time.time()

    def on_agent_speaking(self) -> Optional[int]:
        """
        Called when the first audio chunk from the agent arrives for a turn.
        Calculates and returns latency in milliseconds from the end of user speech.
        """
        self.state = "agent_speaking"
        now = time.time()
        self.agent_speech_start_time = now
        self._agent_turn_finalized = False
        
        latency_ms = None
        if self.user_speech_end_time:
            latency_ms = int((now - self.user_speech_end_time) * 1000)
            latency_ms = max(50, min(latency_ms, 5000))
            self.last_latency_ms = latency_ms
        
        # Reset user speech timers for next turn
        self.user_speech_start_time = None
        self.user_speech_end_time = None
        return latency_ms

    def on_turn_complete(self):
        """Called when the current agent turn is finished."""
        self.state = "idle"
        self.agent_speech_start_time = None

    def on_interrupt(self):
        """Called when user interrupts agent playback."""
        self.state = "listening"
        self.user_speech_start_time = time.time()
        self.user_speech_end_time = time.time()
        self.agent_speech_start_time = None
        self._user_turn_finalized = False

    def append_user_speech(self, segment: str) -> str:
        """Accumulates incoming speech text segment into the current user turn."""
        clean = segment.strip()
        if not clean:
            return self._current_user_turn_text
        if not self._current_user_turn_text:
            self._current_user_turn_text = clean
        else:
            # If the segment already starts with the existing text (snapshot replacement), update
            if clean.startswith(self._current_user_turn_text):
                self._current_user_turn_text = clean
            elif self._current_user_turn_text.endswith(clean):
                pass
            else:
                self._current_user_turn_text += " " + clean
        return self._current_user_turn_text

    def get_current_user_turn(self) -> str:
        return self._current_user_turn_text.strip()

    def finalize_user_turn(self, override_text: Optional[str] = None) -> Optional[str]:
        """Finalizes the accumulated user speech as one single turn and records it."""
        text_to_finalize = (override_text if override_text is not None else self._current_user_turn_text).strip()
        if not text_to_finalize:
            return None
        self._user_turn_finalized = True
        self._current_user_turn_text = ""
        self.add_transcript("user", text_to_finalize, is_final=True)
        return text_to_finalize

    def append_agent_speech(self, delta: str) -> str:
        """Accumulates incoming streaming text for the agent turn."""
        self._current_agent_turn_text += delta
        return self._current_agent_turn_text

    def get_current_agent_turn(self) -> str:
        return self._current_agent_turn_text.strip()

    def finalize_agent_turn(self, override_text: Optional[str] = None) -> Optional[str]:
        """Finalizes the accumulated agent speech as one single turn and records it."""
        text_to_finalize = (override_text if override_text is not None else self._current_agent_turn_text).strip()
        if not text_to_finalize:
            return None
        self._agent_turn_finalized = True
        self._current_agent_turn_text = ""
        self.add_transcript("agent", text_to_finalize, is_final=True)
        return text_to_finalize

    def add_transcript(self, role: str, text: str, is_final: bool = False):
        clean_text = text.strip()
        if not clean_text:
            return
        # Deduplication check: if latest final transcript has same role and text, do not duplicate
        if is_final and self.transcript_history:
            last = self.transcript_history[-1]
            if last.get("role") == role and last.get("text") == clean_text and last.get("is_final"):
                return

        self.transcript_history.append({
            "role": role,
            "text": clean_text,
            "is_final": is_final,
            "timestamp": time.time()
        })

    @property
    def transcripts(self) -> List[Dict[str, Any]]:
        return self.transcript_history

class SessionManager:
    def __init__(self):
        self._sessions: Dict[str, VoiceSession] = {}

    def create_session(self, mode: str = "interviewer", conversation_id: Optional[str] = None) -> VoiceSession:
        session = VoiceSession(mode=mode, conversation_id=conversation_id)
        self._sessions[session.session_id] = session
        logger.info(f"Created voice session: {session.session_id} (mode={mode})")
        return session

    def get_session(self, session_id: str) -> Optional[VoiceSession]:
        return self._sessions.get(session_id)

    def remove_session(self, session_id: str):
        if session_id in self._sessions:
            del self._sessions[session_id]
            logger.info(f"Removed voice session: {session_id}")

session_manager = SessionManager()
