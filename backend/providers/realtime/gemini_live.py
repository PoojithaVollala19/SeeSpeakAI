import os
import re
import asyncio
from typing import AsyncIterator, Union, Dict, Any, Optional
from google import genai
from google.genai import types

from backend.providers.base import BaseRealtimeProvider
from backend.utils.logging import logger

GEMINI_LIVE_CANDIDATE_MODELS = [
    "gemini-3.1-flash-live-preview",
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash-native-audio-latest",
]

def is_internal_thought(text: str) -> bool:
    """Detects internal reasoning/orchestration events that must never be presented to candidate or user."""
    if not text:
        return False
    t = text.strip().lower()
    thought_prefixes = (
        "refining the initial question",
        "refining initial question",
        "initiating interview protocol",
        "initiating interview",
        "analyzing candidate response",
        "analyzing candidate",
        "preparing the next question",
        "preparing next question",
        "generating next question",
        "interview protocol",
        "protocol:",
        "thinking...",
        "thought:",
        "internal prompt",
        "competency evaluated",
        "competency remaining",
        "state: processing_answer"
    )
    if any(t.startswith(p) for p in thought_prefixes):
        return True
    if t in ["refining", "thinking", "protocol", "analyzing", "generating"]:
        return True
    return False

def clean_interviewer_speech(text: str) -> str:
    """Removes model thinking/planning blocks and extracts clean spoken dialogue."""
    if not text:
        return ""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    meta_prefixes = (
        "i've just", "i've noted", "i've finalized", "i've ",
        "i'm ready", "i'm now", "i'm observing", "i'm preparing", "i'm making", "i'm aiming", "i'm ",
        "i plan to", "i will greet", "i will ", "i acknowledge", "i understand the user", "i understand",
        "my goal is to", "to begin my assessment", "refining the initial question", "refining initial question",
        "initiating interview protocol", "initiating interview", "analyzing candidate response", "analyzing candidate",
        "preparing the next question", "preparing next question", "generating next question", "interview protocol",
        "protocol:", "thinking...", "thought:", "internal prompt:"
    )

    spoken = []
    for p in paragraphs:
        if p.startswith("**") and p.endswith("**"):
            continue
        p_sub = re.sub(r'^\*\*[^*]+\*\*\s*', '', p).strip()
        p_lower = p_sub.lower()
        if any(p_lower.startswith(prefix) for prefix in meta_prefixes):
            continue
        lines = [l.strip() for l in p_sub.splitlines() if l.strip()]
        clean_lines = []
        for l in lines:
            l_lower = l.lower()
            if any(l_lower.startswith(prefix) for prefix in meta_prefixes):
                continue
            if is_internal_thought(l):
                continue
            clean_lines.append(l)
        if clean_lines:
            spoken.append("\n".join(clean_lines))

    result = "\n\n".join(spoken) if spoken else re.sub(r'^\*\*[^*]+\*\*\s*', '', paragraphs[-1]).strip()
    if is_internal_thought(result):
        return ""

    # Strip raw markdown symbols for clean spoken and text display
    result = re.sub(r'```[\s\S]*?```', '', result)
    result = re.sub(r'`([^`]+)`', r'\1', result)
    result = re.sub(r'#{1,6}\s+', '', result)
    result = re.sub(r'\*\*([^*]+)\*\*', r'\1', result)
    result = re.sub(r'\*([^*]+)\*', r'\1', result)
    result = re.sub(r'__([^_]+)__', r'\1', result)
    result = re.sub(r'_([^_]+)_', r'\1', result)
    result = re.sub(r'^\s*[-*+]\s+', '', result, flags=re.MULTILINE)
    result = re.sub(r'>\s+', '', result)
    return result.strip()

class GeminiLiveProvider(BaseRealtimeProvider):
    """
    Realtime bidirectional provider utilizing the official Google GenAI Live API.
    Handles PCM16 16kHz audio input and 24kHz audio output with live transcription,
    delivering natural, calm, conversational pacing and coherent paragraph-level turns.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        mode: Optional[str] = None,
        job_role: Optional[str] = None,
        language: Optional[str] = None,
        interview_type: Optional[str] = None,
        difficulty: Optional[str] = None,
        job_description: Optional[str] = None,
        resume_context: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required for GeminiLiveProvider")
        self.client = genai.Client(api_key=self.api_key)
        self._session_ctx = None
        self._session = None
        self._connected = False
        self.input_sample_rate = 16000
        self.output_sample_rate = 24000

        self.mode = mode or "document-analysis"
        self.job_role = job_role or ("Software Engineer" if (mode or "").lower() == "ai-interview" else "")
        self.language = language or "en"
        self.interview_type = interview_type or "Technical"
        self.difficulty = difficulty or "Medium"
        self.job_description = job_description or ""
        self.resume_context = resume_context or {}

        self.has_greeted = False
        self._accumulated_output_text = ""
        self._accumulated_user_text = ""
        self._user_turn_active = False
        self._interrupted = False

    async def connect(self, system_prompt: str, voice_name: str = "Aoede") -> None:
        """
        Connects to the best available Gemini Live model using a calm, natural conversational voice
        and initiates introductory dialogue.
        """
        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            system_instruction=types.Content(parts=[types.Part.from_text(text=system_prompt)]),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
                )
            ),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig()
        )

        last_error = None
        for model in GEMINI_LIVE_CANDIDATE_MODELS:
            try:
                logger.info(f"[VOICE] Attempting connection to Gemini Live with model: {model}")
                self._session_ctx = self.client.aio.live.connect(model=model, config=config)
                self._session = await asyncio.wait_for(self._session_ctx.__aenter__(), timeout=5.0)
                self._connected = True
                logger.info(f"[VOICE] Gemini session connected with model: {model} (voice={voice_name}, mode={self.mode})")

                # Kick off initial greeting ONLY for interview or customer support sessions
                if not self.has_greeted:
                    self.has_greeted = True
                    candidate_name = self.resume_context.get("candidate_name") or "candidate"
                    lang_map = {
                        "en": "English", "te": "Telugu", "hi": "Hindi", "ta": "Tamil",
                        "kn": "Kannada", "mr": "Marathi", "es": "Spanish", "fr": "French"
                    }
                    lang_name = lang_map.get(self.language, self.language)
                    
                    is_interview = bool("interview" in self.mode.lower() or self.mode.lower() in ["ai-interview", "interviewer"])
                    is_support = bool("support" in self.mode.lower() or "cust" in self.mode.lower())

                    if is_interview:
                        kickoff_msg = (
                            f"Start the interview session now. Greet {candidate_name} warmly for the {self.job_role} position ({self.interview_type}) "
                            f"in one or two clear, professional sentences, dynamically ask your first interview question based on their background/role, and pause naturally for their answer. "
                            f"Speak in a calm, clear conversational cadence. "
                            f"You MUST speak exclusively in {lang_name} ({self.language}). Do NOT use English unless the selected language is English."
                        )
                        try:
                            await self._session.send_realtime_input(text=kickoff_msg)
                            logger.info(f"[VOICE] Interview kickoff prompt sent to Gemini Live: {kickoff_msg[:60]}...")
                        except Exception as k_err:
                            logger.warning(f"[VOICE] Could not send initial kickoff prompt: {k_err}")
                    elif is_support:
                        kickoff_msg = f"Start the customer support session now. Greet the customer warmly in {lang_name} and ask how you can assist them today."
                        try:
                            await self._session.send_realtime_input(text=kickoff_msg)
                            logger.info(f"[VOICE] Support kickoff prompt sent to Gemini Live")
                        except Exception as k_err:
                            logger.warning(f"[VOICE] Could not send support kickoff: {k_err}")
                    else:
                        # In normal modules (document-analysis, visual-intelligence, etc.), do NOT prompt with interview logic.
                        # Wait for user to speak or ask their prompt.
                        logger.info(f"[VOICE] Module '{self.mode}' ready. Waiting for user speech prompt.")

                return
            except Exception as e:
                logger.warning(f"[VOICE] Failed to connect to model {model}: {e}")
                last_error = e

        raise RuntimeError(f"Unable to connect to any Gemini Live models: {last_error}")

    async def send_audio(self, audio_data: bytes) -> None:
        """Sends a 16kHz PCM16 chunk to Gemini Live."""
        if not self._connected or not self._session:
            return
        self._user_turn_active = True
        try:
            await self._session.send_realtime_input(
                audio=types.Blob(data=audio_data, mime_type="audio/pcm;rate=16000")
            )
        except Exception as e:
            logger.error(f"[VOICE] Error sending audio to Gemini Live: {e}")

    async def finish_user_turn(self) -> None:
        """Explicitly signals end of user turn to Gemini Live so it finishes turn and responds."""
        if not self._connected or not self._session:
            return
        logger.info("[VOICE] Signaling finish_user_turn (audio_stream_end=True) to Gemini Live")
        try:
            await self._session.send_realtime_input(audio_stream_end=True)
        except Exception as e:
            logger.warning(f"[VOICE] Could not send audio_stream_end to Gemini Live: {e}")

    async def send_text(self, text: str) -> None:
        """Sends user text message to Gemini Live."""
        if not self._connected or not self._session:
            return
        logger.info(f"[VOICE] Sending text message to Gemini Live: {text[:60]}")
        self._user_turn_active = True
        try:
            await self._session.send_client_content(
                turns=[types.Content(role="user", parts=[types.Part.from_text(text=text)])],
                turn_complete=True
            )
        except Exception:
            try:
                await self._session.send_realtime_input(text=text)
                await self._session.send_realtime_input(audio_stream_end=True)
            except Exception as e:
                logger.error(f"[VOICE] Error sending text to Gemini Live: {e}")

    async def interrupt(self) -> None:
        """Notifies provider that user has interrupted."""
        logger.info("[VOICE] User barge-in interruption triggered")
        self._interrupted = True
        self._accumulated_output_text = ""

    async def receive(self) -> AsyncIterator[Union[bytes, Dict[str, Any]]]:
        """
        Yields audio chunks, coherent paragraph transcripts, interruptions,
        and turn completion signals.
        """
        if not self._connected or not self._session:
            return

        try:
            while self._connected and self._session:
                async for message in self._session.receive():
                    sc = message.server_content
                    if not sc:
                        continue

                    # 1. Interruption notification from server
                    if getattr(sc, "interrupted", False):
                        logger.info("[VOICE] Gemini Live reported user interruption")
                        self._accumulated_output_text = ""
                        yield {"type": "interrupted"}

                    # 2. User speech transcription from Gemini STT
                    in_trans = getattr(sc, "input_transcription", None)
                    interim_trans = getattr(sc, "interim_input_transcription", None)

                    if in_trans and in_trans.text:
                        new_text = in_trans.text.strip()
                        # Append or update user turn text
                        if not self._accumulated_user_text:
                            self._accumulated_user_text = new_text
                        elif new_text.startswith(self._accumulated_user_text):
                            self._accumulated_user_text = new_text
                        elif not self._accumulated_user_text.endswith(new_text):
                            self._accumulated_user_text += " " + new_text

                        is_finished = bool(getattr(in_trans, "finished", False))
                        yield {
                            "type": "input_transcript",
                            "text": self._accumulated_user_text,
                            "is_final": is_finished
                        }
                        if is_finished:
                            self._accumulated_user_text = ""

                    elif interim_trans and interim_trans.text:
                        interim_text = interim_trans.text.strip()
                        display_text = self._accumulated_user_text + (" " if self._accumulated_user_text else "") + interim_text
                        yield {
                            "type": "input_transcript",
                            "text": display_text,
                            "is_final": False
                        }

                    # 3. Agent speech transcription delta
                    if getattr(sc, "output_transcription", None) and sc.output_transcription.text:
                        delta = sc.output_transcription.text
                        if is_internal_thought(delta):
                            yield {"type": "internal_event", "event": "internal_reasoning", "detail": delta}
                        else:
                            self._accumulated_output_text += delta
                            clean_stream = clean_interviewer_speech(self._accumulated_output_text)
                            if clean_stream and not is_internal_thought(clean_stream):
                                # Finalize any pending user turn when agent begins output
                                if self._accumulated_user_text:
                                    yield {
                                        "type": "input_transcript",
                                        "text": self._accumulated_user_text,
                                        "is_final": True
                                    }
                                    self._accumulated_user_text = ""

                                yield {
                                    "type": "output_transcript",
                                    "text": clean_stream,
                                    "is_final": False
                                }

                    # 4. Audio parts and text
                    if getattr(sc, "model_turn", None) and sc.model_turn.parts:
                        # Finalize any pending user turn once agent starts generating parts
                        if self._accumulated_user_text:
                            yield {
                                "type": "input_transcript",
                                "text": self._accumulated_user_text,
                                "is_final": True
                            }
                            self._accumulated_user_text = ""

                        for part in sc.model_turn.parts:
                            if getattr(part, "inline_data", None) and part.inline_data.data:
                                audio_chunk = part.inline_data.data
                                yield audio_chunk
                            elif getattr(part, "text", None):
                                if not is_internal_thought(part.text):
                                    self._accumulated_output_text += part.text
                                    clean_stream = clean_interviewer_speech(self._accumulated_output_text)
                                    if clean_stream and not is_internal_thought(clean_stream):
                                        yield {
                                            "type": "output_transcript",
                                            "text": clean_stream,
                                            "is_final": False
                                        }

                    # 5. Agent Turn Complete
                    if getattr(sc, "turn_complete", False):
                        # Ensure any pending user text was marked final
                        if self._accumulated_user_text:
                            yield {
                                "type": "input_transcript",
                                "text": self._accumulated_user_text,
                                "is_final": True
                            }
                            self._accumulated_user_text = ""

                        if self._accumulated_output_text:
                            clean_text = clean_interviewer_speech(self._accumulated_output_text)
                            if clean_text and not is_internal_thought(clean_text):
                                logger.info(f"[VOICE] Gemini AI turn finalized: {clean_text[:80]}...")
                                yield {
                                    "type": "output_transcript",
                                    "text": clean_text,
                                    "is_final": True
                                }
                            self._accumulated_output_text = ""
                        yield {"type": "turn_complete"}

        except asyncio.CancelledError:
            logger.info("[VOICE] Gemini Live receive loop cancelled")
        except Exception as e:
            logger.error(f"[VOICE] Error in Gemini Live receive loop: {e}")
            yield {"type": "error", "message": str(e)}

    async def send_video(self, frame_bytes: bytes, mime_type: str = "image/jpeg") -> None:
        """Sends an image/video frame from camera or screen share to Gemini Live in-memory."""
        if not self._connected or not self._session:
            return
        try:
            await self._session.send_realtime_input(
                video=types.Blob(data=frame_bytes, mime_type=mime_type)
            )
        except Exception as e:
            logger.warning(f"[VOICE] Could not send video frame to Gemini Live: {e}")

    async def close(self) -> None:
        """Closes session cleanly."""
        self._connected = False
        if self._session_ctx:
            try:
                await self._session_ctx.__aexit__(None, None, None)
            except Exception as e:
                logger.warning(f"Error exiting Gemini Live context: {e}")
            self._session_ctx = None
            self._session = None
        logger.info("[VOICE] Gemini Live session closed")

