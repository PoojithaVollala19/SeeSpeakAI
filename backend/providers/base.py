from abc import ABC, abstractmethod
from typing import AsyncIterator, Union, Dict, Any

class BaseRealtimeProvider(ABC):
    """
    Abstract base class for all real-time voice providers.
    Normalizes audio streaming, transcription, interruptions, and turn completion.
    """

    @abstractmethod
    async def connect(self, system_prompt: str, voice_name: str = "Puck") -> None:
        """Establishes bidirectional connection with the provider."""
        pass

    @abstractmethod
    async def send_audio(self, audio_data: bytes) -> None:
        """Sends a PCM16 audio chunk (16kHz, mono) to the provider."""
        pass

    @abstractmethod
    async def receive(self) -> AsyncIterator[Union[bytes, Dict[str, Any]]]:
        """
        Async generator yielding normalized events:
        - bytes: Raw PCM audio bytes (24kHz, mono)
        - {"type": "input_transcript", "text": "...", "is_final": bool}
        - {"type": "output_transcript", "text": "...", "is_final": bool}
        - {"type": "interrupted"}
        - {"type": "turn_complete"}
        - {"type": "error", "message": "..."}
        """
        pass

    @abstractmethod
    async def send_text(self, text: str) -> None:
        """Sends a text message to the provider."""
        pass

    @abstractmethod
    async def interrupt(self) -> None:
        """Notifies the provider of an interruption to stop current speech synthesis/output."""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Closes the connection and releases resources."""
        pass

    async def send_video(self, frame_bytes: bytes, mime_type: str = "image/jpeg") -> None:
        """Sends an image/video frame (e.g. from camera or screen share) to the provider in-memory."""
        pass

