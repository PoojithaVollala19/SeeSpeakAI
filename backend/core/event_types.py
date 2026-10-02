from enum import Enum
from typing import Optional, Literal
from pydantic import BaseModel, Field

class EventType(str, Enum):
    SESSION_START = "session_start"
    SESSION_READY = "session_ready"
    USER_SPEAKING = "user_speaking"
    AGENT_SPEAKING = "agent_speaking"
    TURN_COMPLETE = "turn_complete"
    INTERRUPT = "interrupt"
    LATENCY = "latency"
    ERROR = "error"
    TRANSCRIPT = "transcript"

class SessionStartEvent(BaseModel):
    type: Literal["session_start"] = "session_start"
    mode: str = Field(default="interviewer", description="interviewer or customer_service")
    conversation_id: Optional[str] = None

class SessionReadyEvent(BaseModel):
    type: Literal["session_ready"] = "session_ready"
    session_id: str
    mode: str
    sample_rate: int = 24000
    voice_mode: str = "gemini"  # "gemini" or "mock"

class UserSpeakingEvent(BaseModel):
    type: Literal["user_speaking"] = "user_speaking"

class AgentSpeakingEvent(BaseModel):
    type: Literal["agent_speaking"] = "agent_speaking"
    latency: Optional[int] = None  # in milliseconds

class TurnCompleteEvent(BaseModel):
    type: Literal["turn_complete"] = "turn_complete"

class InterruptEvent(BaseModel):
    type: Literal["interrupt"] = "interrupt"

class LatencyEvent(BaseModel):
    type: Literal["latency"] = "latency"
    latency_ms: int

class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str

class TranscriptEvent(BaseModel):
    type: Literal["transcript"] = "transcript"
    role: Literal["user", "agent"]
    text: str
    is_final: bool = False
    language: Optional[str] = None
    timestamp: Optional[str] = None
    status: Optional[str] = None
