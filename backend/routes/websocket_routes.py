import os
import json
import asyncio
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.core.event_types import (
    EventType,
    SessionStartEvent,
    SessionReadyEvent,
    AgentSpeakingEvent,
    TurnCompleteEvent,
    InterruptEvent,
    TranscriptEvent,
    ErrorEvent
)
from backend.core.session_manager import session_manager, VoiceSession
from backend.providers.factory import get_realtime_provider
from backend.services.resume_parser import format_resume_context_for_prompt
from backend.utils.logging import logger
from backend.utils.language_detector import detect_text_language, resolve_interaction_language

router = APIRouter(tags=["voice"])

from backend.repositories.conversation_repository import conversation_repository
from backend.repositories.ticket_repository import ticket_repository
from backend.repositories.interview_repository import interview_repository

PROMPT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "core", "prompts")

LANGUAGE_NAMES = {
    "en": "English",
    "te": "Telugu",
    "hi": "Hindi",
    "kn": "Kannada",
    "mr": "Marathi",
    "ta": "Tamil",
    "ml": "Malayalam",
    "bn": "Bengali",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ur": "Urdu",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
}

def is_internal_orchestration_message(text: str) -> bool:
    """Detects internal model reasoning/orchestration events that must never be presented to user."""
    if not text:
        return False
    t_clean = text.strip().lower()
    thought_prefixes = (
        "refining the initial question",
        "refining initial question",
        "initiating interview protocol",
        "initiating interview",
        "analyzing candidate response",
        "analyzing candidate",
        "evaluating response",
        "evaluating candidate response",
        "preparing the next question",
        "preparing next question",
        "generating next question",
        "generating question",
        "selecting next question",
        "interview protocol",
        "protocol:",
        "thinking...",
        "ai is thinking",
        "processing...",
        "processing candidate response",
        "processing answer",
        "thought:",
        "internal reasoning",
        "internal prompt",
        "competency evaluated",
        "competency remaining",
        "state: processing_answer"
    )
    if any(t_clean.startswith(prefix) for prefix in thought_prefixes):
        return True
    if any(phrase in t_clean for phrase in [
        "refining the initial question",
        "initiating interview protocol",
        "ai is thinking",
        "processing candidate response",
        "processing answer",
        "evaluating response",
        "selecting next question",
        "internal reasoning"
    ]):
        return True
    if t_clean in ["refining", "thinking", "protocol", "analyzing", "generating"]:
        return True
    # Check if raw JSON was output
    if t_clean.startswith("{") and t_clean.endswith("}"):
        return True
    return False

def load_prompt_for_mode(
    mode: str,
    conv_id: Optional[str] = None,
    language: str = "en",
    ticket_id: Optional[str] = None,
    interview_type: Optional[str] = None,
    job_role: Optional[str] = None,
    experience_level: Optional[str] = None,
    difficulty: Optional[str] = None,
    job_description: Optional[str] = None,
    resume_context: Optional[dict] = None,
    blueprint_prompt: Optional[str] = None
) -> str:
    """Loads feature-specific system prompt and injects grounded file/ticket/interview context if available."""
    m = (mode or "").lower().strip()
    is_interview = bool("interview" in m or m in ["ai-interview", "interviewer"])
    
    if "doc" in m:
        filename = "document_analysis.md"
    elif "vis" in m or "image" in m:
        filename = "visual_intelligence.md"
    elif "supp" in m or "cust" in m:
        filename = "customer_support.md"
    elif "meet" in m or "video" in m or "audio" in m:
        filename = "video_audio_review.md"
    elif "study" in m or "data" in m:
        filename = "data_study.md"
    elif is_interview:
        filename = "ai_interview.md"
    else:
        filename = None

    filepath = os.path.join(PROMPT_DIR, filename) if filename else ""
    if filepath and not os.path.exists(filepath):
        # Fallback to alternate names
        if filename == "ai_interview.md":
            filepath = os.path.join(PROMPT_DIR, "interviewer.md")
        elif filename == "customer_support.md":
            filepath = os.path.join(PROMPT_DIR, "customer_service.md")

    base_prompt = "You are an intelligent, concise, and helpful voice AI assistant for SeeSpeak AI."
    if filepath and os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            base_prompt = f.read()

    # Append grounded file context if conversation has files attached
    file_context = ""
    if conv_id:
        conv = conversation_repository.get_conversation(conv_id)
        if conv and conv.get("files"):
            file_summaries = []
            for f in conv["files"]:
                fname = f.get("filename", "File")
                fpath = f.get("file_path", "")
                content_snippet = ""
                if os.path.exists(fpath):
                    try:
                        with open(fpath, "r", encoding="utf-8", errors="ignore") as file_handle:
                            content_snippet = file_handle.read(4000)
                    except Exception:
                        pass
                file_summaries.append(f"--- Document '{fname}' ---\n{content_snippet}")
            if file_summaries:
                file_context = "\n\n### ATTACHED WORKSPACE FILES FOR THIS CONVERSATION:\n" + "\n\n".join(file_summaries)

    # Append ticket context if active in customer service mode
    ticket_context = ""
    if ticket_id:
        try:
            ticket_context = ticket_repository.get_ticket_context_prompt(ticket_id)
        except Exception as e:
            logger.warning(f"Failed to fetch ticket context: {e}")

    # Append dynamic interview role specialization and resume grounding ONLY IF INTERVIEW MODE
    interview_instruction = ""
    lang_name = LANGUAGE_NAMES.get(language, "English")
    if is_interview:
        effective_role = job_role or interview_type or "Software Engineer"
        effective_level = experience_level or "Standard"
        effective_type = interview_type or "Technical & Coding"
        base_prompt = base_prompt.replace("{role}", effective_role).replace("{job_role}", effective_role)
        base_prompt = base_prompt.replace("{level}", effective_level).replace("{experience_level}", effective_level)
        base_prompt = base_prompt.replace("{interview_type}", effective_type)
        base_prompt = base_prompt.replace("{language}", lang_name)

        formatted_resume = format_resume_context_for_prompt(resume_context)

        interview_instruction = (
            f"\n\n==================================================\n"
            f"### DYNAMIC ADAPTIVE INTERVIEW SESSION CONTEXT\n"
            f"You are a professional, seasoned interviewer conducting an intelligent, real-time voice interview.\n\n"
            f"Interview Type: {effective_type}\n"
            f"Target Position / Job Role: {effective_role}\n"
            f"Candidate Experience Level: {effective_level}\n"
            f"Preferred Language: {lang_name} ({language})\n\n"
            f"Candidate Resume & Verified Context Evidence:\n{formatted_resume}\n"
        )
        if job_description:
            interview_instruction += f"\nTarget Job Requirements / Focus Areas: {job_description}\n"

        if blueprint_prompt:
            interview_instruction += f"\n{blueprint_prompt}\n"

        interview_instruction += (
            f"\n### MANDATORY DYNAMIC INTERVIEW SYSTEM RULES:\n"
            f"1. STRICT CURRENT INTERACTION LANGUAGE PRIORITY: You must ALWAYS communicate in the language that the candidate is CURRENTLY USING. "
            f"If the candidate speaks Telugu, you MUST ask questions and speak strictly in Telugu. "
            f"If the candidate speaks Hindi, you MUST ask questions and speak strictly in Hindi. "
            f"If the candidate speaks English, speak in English. "
            f"If the candidate switches languages mid-interview, immediately follow their current interaction language. "
            f"Previous or default language settings must NOT override the candidate's current language. "
            f"Technical terms (e.g. React, Node.js, SQL, Docker, AWS, JWT) may remain in standard form when naturally used.\n"
            f"2. ONE QUESTION AT A TIME: Greet briefly once, then ask exactly ONE clear, focused question and pause completely to let the candidate answer.\n"
            f"3. WAIT FOR COMPLETE ANSWERS: Never interrupt normal candidate speech or react to partial phrases.\n"
            f"4. DYNAMIC GENERATION (NO HARDCODED QUESTIONS): Every question must be generated dynamically based on the target role, experience level, interview type, resume evidence, and the candidate's previous responses. Never use a predetermined script or static question list.\n"
            f"5. NO QUESTION LIMIT (CONTINUE INDEFINITELY): Do NOT stop after 4 or 5 questions. Never use a hidden question-count limit. Continue asking relevant follow-ups and questions indefinitely until the candidate explicitly requests to end the interview or presses 'End Interview'.\n"
            f"6. ACTIVE ADAPTIVE FOLLOW-UPS & DIFFICULTY CALIBRATION:\n"
            f"   - When the candidate gives a strong, knowledgeable answer, probe deeper into architectural trade-offs, edge cases, implementation specifics, or metrics.\n"
            f"   - If the candidate struggles or provides a shallow answer, ask an appropriate follow-up or practical clarification question without being condescending.\n"
            f"7. RESUME GROUNDING & EVIDENCE:\n"
            f"   - Actively inquire about actual projects, technologies, and achievements listed on the candidate's resume.\n"
            f"   - Do NOT invent technologies or skills the candidate does not have. Probe claimed experience neutrally.\n"
            f"8. CANDIDATE REQUEST HANDLING:\n"
            f"   - Repeat request: Politely repeat/rephrase in {lang_name}.\n"
            f"   - Clarification request: Explain in simpler practical terms in {lang_name}.\n"
            f"   - Example request: Provide a brief illustrative scenario in {lang_name} without answering for them.\n"
            f"   - Skip request: Acknowledge supportively and move to another relevant competency area in {lang_name}.\n"
            f"   - Slow down request: Acknowledge and speak more slowly.\n"
            f"   - End interview request: Conclude warmly and announce evaluation compilation.\n"
            f"9. DIRECT SPOKEN DIALOGUE ONLY: Output ONLY the words to be spoken aloud directly to the candidate. NEVER output internal thoughts, chain-of-thought, bullet points, headers, or markdown formatting."
        )

    module_guidance = ""
    if not is_interview:
        if "doc" in m:
            module_guidance = (
                "\n\n### STRICT DOCUMENT ANALYSIS OPERATIONAL RULES:\n"
                "1. Answer ONLY based on the attached workspace document(s) and user's specific prompt.\n"
                "2. NEVER ask software engineering interview questions, candidate questions, or resume questions.\n"
                "3. NEVER initiate or conduct an interview. Keep all responses directly focused on document comprehension."
            )
        elif "vis" in m or "image" in m:
            module_guidance = (
                "\n\n### STRICT VISUAL INTELLIGENCE OPERATIONAL RULES:\n"
                "1. Answer strictly based on the visual elements, charts, diagrams, or screenshots uploaded.\n"
                "2. NEVER ask job interview questions or candidate questions."
            )
        elif "meet" in m or "video" in m or "audio" in m:
            module_guidance = (
                "\n\n### STRICT MEDIA REVIEW OPERATIONAL RULES:\n"
                "1. Summarize and analyze the provided audio or video recording.\n"
                "2. NEVER ask job interview questions."
            )
        elif "supp" in m or "cust" in m:
            module_guidance = (
                "\n\n### STRICT CUSTOMER SUPPORT OPERATIONAL RULES:\n"
                "1. Assist the customer empathetically with their inquiry, order, or technical support issue.\n"
                "2. NEVER conduct a job interview."
            )

    lang_instruction = (
        f"\n\nMANDATORY LANGUAGE ENFORCEMENT (CURRENT USER LANGUAGE: {lang_name.upper()}):\n"
        f"Respond only in the user's currently selected language: {lang_name}.\n"
        f"Respond exclusively in {lang_name}. Do not switch to another language unless the user explicitly changes the application language.\n"
        f"CRITICAL USER INTERACTION LANGUAGE RULE: If the candidate or user speaks or answers in Telugu, you MUST speak and respond strictly in Telugu. "
        f"If the user speaks or answers in Hindi, you MUST speak and respond strictly in Hindi. "
        f"If the user speaks or answers in English, speak in English. "
        f"If the user switches languages, immediately follow their current interaction language. "
        f"Keep spoken answers concise, engaging, natural, and free of markdown syntax."
    )

    return f"{base_prompt}{file_context}{ticket_context}{interview_instruction}{module_guidance}{lang_instruction}"

@router.websocket("/ws/session")
async def websocket_session_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket client connected to /ws/session")

    session: Optional[VoiceSession] = None
    provider = None
    task_a = None
    task_b = None

    try:
        # 1. Handshake: wait for session_start
        init_data = await websocket.receive_text()
        try:
            init_json = json.loads(init_data)
        except Exception:
            await websocket.send_text(ErrorEvent(message="Invalid JSON in initial handshake").model_dump_json())
            await websocket.close()
            return

        if init_json.get("type") != EventType.SESSION_START:
            await websocket.send_text(ErrorEvent(message="Expected session_start event").model_dump_json())
            await websocket.close()
            return

        mode = init_json.get("mode") or init_json.get("feature_id") or "document-analysis"
        conv_id = init_json.get("conversation_id")
        language = init_json.get("language", "en")
        voice_mode_override = init_json.get("voice_mode")  # e.g., 'gemini' or 'mock'
        ticket_id = init_json.get("ticket_id")
        interview_type = init_json.get("interview_type")
        interview_session_id = init_json.get("interview_session_id") or init_json.get("interview_id")

        # Extract rich interview configuration & resume context
        job_role = init_json.get("job_role")
        experience_level = init_json.get("experience_level")
        difficulty = init_json.get("difficulty")
        job_description = init_json.get("job_description")
        resume_context = init_json.get("resume_context")

        is_interview_mode = bool("interview" in mode.lower() or mode.lower() in ["ai-interview", "interviewer"])

        # If interview mode, ensure interview session exists or auto-create one
        if is_interview_mode and not interview_session_id:
            try:
                new_sess = interview_repository.create_session(
                    interview_type=interview_type or "Technical",
                    language=language,
                    experience_metrics={
                        "job_role": job_role or "Software Engineer",
                        "experience_level": experience_level or "Standard",
                        "difficulty": difficulty or "Medium",
                        "job_description": job_description or "",
                        "resume_context": resume_context or {}
                    }
                )
                interview_session_id = new_sess["id"]
            except Exception as e:
                logger.warning(f"Failed to auto-create interview session: {e}")

        # If session already created, pull stored config if needed
        if is_interview_mode and interview_session_id and (not job_role or not experience_level or not resume_context):
            try:
                sess_info = interview_repository.get_session(interview_session_id)
                if sess_info and sess_info.get("experience_metrics"):
                    m_data = sess_info["experience_metrics"]
                    job_role = job_role or m_data.get("job_role")
                    experience_level = experience_level or m_data.get("experience_level")
                    difficulty = difficulty or m_data.get("difficulty")
                    job_description = job_description or m_data.get("job_description")
                    resume_context = resume_context or m_data.get("resume_context")
            except Exception:
                pass

        # Generate tailored interview blueprint if in interview mode
        blueprint_prompt = None
        if is_interview_mode:
            try:
                from backend.services.interview_blueprint import generate_interview_blueprint, format_blueprint_for_prompt
                bp = await generate_interview_blueprint(
                    role=job_role or "Software Engineer",
                    level=experience_level or "Mid-Level",
                    interview_type=interview_type or "Technical & Coding",
                    resume_profile=resume_context,
                    jd_text=job_description
                )
                blueprint_prompt = format_blueprint_for_prompt(bp)
            except Exception as e:
                logger.warning(f"Failed to generate blueprint prompt: {e}")

        # Create session
        session = session_manager.create_session(mode=mode, conversation_id=conv_id)

        # Load feature & conversation-grounded system prompt
        system_prompt = load_prompt_for_mode(
            mode,
            conv_id=conv_id,
            language=language,
            ticket_id=ticket_id,
            interview_type=interview_type,
            job_role=job_role,
            experience_level=experience_level,
            difficulty=difficulty,
            job_description=job_description,
            resume_context=resume_context,
            blueprint_prompt=blueprint_prompt
        )

        # Select & initialize provider with explicit mode and configuration
        provider, resolved_voice_mode = get_realtime_provider(
            voice_mode_override,
            mode=mode,
            conversation_id=conv_id,
            job_role=job_role,
            experience_level=experience_level,
            interview_type=interview_type,
            difficulty=difficulty,
            job_description=job_description,
            resume_context=resume_context,
            interview_session_id=interview_session_id if is_interview_mode else None,
            language=language
        )
        try:
            await asyncio.wait_for(provider.connect(system_prompt=system_prompt), timeout=10.0)
        except Exception as e:
            logger.error(f"Failed to connect provider: {e}")
            if resolved_voice_mode == "gemini":
                logger.warning("Gemini Live connection failed; falling back to MockRealtimeProvider")
                try:
                    from backend.providers.realtime.mock_realtime import MockRealtimeProvider
                    provider = MockRealtimeProvider(
                        mode=mode,
                        job_role=job_role,
                        experience_level=experience_level,
                        interview_type=interview_type,
                        difficulty=difficulty,
                        job_description=job_description,
                        resume_context=resume_context,
                        interview_session_id=interview_session_id,
                        language=language
                    )
                    resolved_voice_mode = "mock"
                    await provider.connect(system_prompt=system_prompt)
                except Exception as mock_err:
                    logger.error(f"Mock fallback failed: {mock_err}")
                    await websocket.send_text(ErrorEvent(message=f"Voice provider error: {str(e)}").model_dump_json())
                    await websocket.close()
                    return
            else:
                await websocket.send_text(ErrorEvent(message=f"Voice provider error: {str(e)}").model_dump_json())
                await websocket.close()
                return

        # Send session_ready event
        ready_evt = SessionReadyEvent(
            session_id=session.session_id,
            mode=mode,
            sample_rate=provider.output_sample_rate,
            voice_mode=resolved_voice_mode
        )
        await websocket.send_text(ready_evt.model_dump_json())
        logger.info(f"[VOICE] Sent session_ready for session {session.session_id} (mode={mode}, sample_rate={provider.output_sample_rate}, voice_mode={resolved_voice_mode})")

        # Task A: Client -> Provider
        async def client_to_provider():
            nonlocal language
            first_chunk_of_turn = True
            while True:
                try:
                    msg = await websocket.receive()
                except (WebSocketDisconnect, RuntimeError):
                    break
                except Exception as e:
                    logger.warning(f"Error receiving from client websocket: {e}")
                    break

                if "bytes" in msg and msg["bytes"]:
                    audio_chunk = msg["bytes"]
                    # Barge-in: if agent is currently speaking, user speech interrupts immediately
                    if session.state == "agent_speaking":
                        if "interview" in mode or mode == "interviewer":
                            continue
                        logger.info("[VOICE] Barge-in: User audio received while agent speaking, interrupting")
                        session.on_interrupt()
                        first_chunk_of_turn = True
                        if hasattr(provider, "interrupt"):
                            try:
                                await provider.interrupt()
                            except Exception:
                                pass
                        try:
                            await websocket.send_text(InterruptEvent().model_dump_json())
                        except Exception:
                            pass

                    if first_chunk_of_turn:
                        session.on_user_speaking()
                        first_chunk_of_turn = False
                    else:
                        session.user_speech_end_time = asyncio.get_event_loop().time()
                    await provider.send_audio(audio_chunk)

                elif "text" in msg and msg["text"]:
                    try:
                        data = json.loads(msg["text"])
                        evt_type = data.get("type")
                        if evt_type == "user_speaking":
                            if session.state == "agent_speaking":
                                logger.info("Barge-in: user_speaking event while agent speaking")
                                session.on_interrupt()
                                if hasattr(provider, "interrupt"):
                                    try:
                                        await provider.interrupt()
                                    except Exception:
                                        pass
                                try:
                                    await websocket.send_text(InterruptEvent().model_dump_json())
                                except Exception:
                                    pass
                            session.on_user_speaking()
                            first_chunk_of_turn = False
                        elif evt_type == "user_silent":
                            session.on_user_silent()
                            first_chunk_of_turn = True
                            if hasattr(provider, "finish_user_turn"):
                                try:
                                    await provider.finish_user_turn()
                                except Exception as e:
                                    logger.warning(f"Error calling finish_user_turn on provider: {e}")
                        elif evt_type == "interrupt":
                            logger.info("Manual interrupt event received from client")
                            session.on_interrupt()
                            first_chunk_of_turn = True
                            if hasattr(provider, "interrupt"):
                                try:
                                    await provider.interrupt()
                                except Exception:
                                    pass
                            try:
                                await websocket.send_text(InterruptEvent().model_dump_json())
                            except Exception:
                                pass
                        elif evt_type in ["user_text", "text", "message"]:
                            u_text = data.get("text") or data.get("message") or ""
                            if u_text:
                                detected_typed_lang = detect_text_language(u_text)
                                if detected_typed_lang and detected_typed_lang != language:
                                    logger.info(f"[VOICE] User typed language switched to: {detected_typed_lang}")
                                    language = detected_typed_lang
                                    if hasattr(provider, "language"):
                                        provider.language = detected_typed_lang

                                if session.state == "agent_speaking":
                                    session.on_interrupt()
                                    if hasattr(provider, "interrupt"):
                                        try:
                                            await provider.interrupt()
                                        except Exception:
                                            pass
                                    try:
                                        await websocket.send_text(InterruptEvent().model_dump_json())
                                    except Exception:
                                        pass
                                session.on_user_speaking()
                                final_u = session.finalize_user_turn(override_text=u_text) or u_text
                                try:
                                    await websocket.send_text(TranscriptEvent(
                                        role="user",
                                        text=final_u,
                                        is_final=True,
                                        language=language,
                                        timestamp=datetime.now(timezone.utc).isoformat(),
                                        status="final"
                                    ).model_dump_json())
                                except Exception:
                                    pass
                                if interview_session_id:
                                    try:
                                        sess = interview_repository.get_session(interview_session_id)
                                        if sess:
                                            t_list = sess.get("transcript", [])
                                            if not (t_list and t_list[-1].get("speaker") == "user" and t_list[-1].get("text") == final_u):
                                                t_list.append({
                                                    "speaker": "user",
                                                    "text": final_u,
                                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                                    "language": language
                                                })
                                                interview_repository.update_transcript(interview_session_id, t_list)
                                    except Exception as e:
                                        logger.warning(f"Failed to record typed interview user turn: {e}")
                                session.on_user_silent()
                                await provider.send_text(final_u)
                        elif evt_type in ["video_frame", "video", "screen_frame", "camera_frame"]:
                            raw_data = data.get("data") or data.get("frame") or data.get("image") or ""
                            mime = data.get("mime_type") or data.get("mimeType") or "image/jpeg"
                            if raw_data and hasattr(provider, "send_video"):
                                try:
                                    import base64
                                    if isinstance(raw_data, str):
                                        if "," in raw_data:
                                            raw_data = raw_data.split(",", 1)[1]
                                        frame_bytes = base64.b64decode(raw_data)
                                    else:
                                        frame_bytes = bytes(raw_data)
                                    await provider.send_video(frame_bytes, mime_type=mime)
                                except Exception as e:
                                    logger.warning(f"Error handling video frame: {e}")
                    except Exception as e:
                        logger.warning(f"Error parsing client text event: {e}")

        # Task B: Provider -> Client
        async def provider_to_client():
            nonlocal language
            is_first_audio_chunk = True
            async for item in provider.receive():
                if isinstance(item, bytes):
                    # Raw PCM16 24kHz audio chunk from agent
                    if is_first_audio_chunk:
                        is_first_audio_chunk = False
                        # Finalize any pending user turn if not yet finalized
                        pending_user = session.finalize_user_turn()
                        if pending_user and interview_session_id:
                            try:
                                sess = interview_repository.get_session(interview_session_id)
                                if sess:
                                    t_list = sess.get("transcript", [])
                                    if not (t_list and t_list[-1].get("speaker") == "user" and t_list[-1].get("text") == pending_user):
                                        t_list.append({
                                            "speaker": "user",
                                            "text": pending_user,
                                            "timestamp": datetime.now(timezone.utc).isoformat(),
                                            "language": language
                                        })
                                        interview_repository.update_transcript(interview_session_id, t_list)
                            except Exception as e:
                                logger.warning(f"Failed to record finalized user turn: {e}")

                        latency_ms = session.on_agent_speaking()
                        speak_evt = AgentSpeakingEvent(latency=latency_ms)
                        await websocket.send_text(speak_evt.model_dump_json())
                        if latency_ms:
                            logger.info(f"Agent speaking latency: {latency_ms} ms")

                    # Send binary audio frame
                    await websocket.send_bytes(item)

                elif isinstance(item, dict):
                    t = item.get("type")
                    if t == "interrupted":
                        is_first_audio_chunk = True
                        session.on_interrupt()
                        interrupt_evt = InterruptEvent()
                        await websocket.send_text(interrupt_evt.model_dump_json())
                        logger.info("Sent interrupt event to client")

                    elif t == "turn_complete":
                        is_first_audio_chunk = True
                        session.on_turn_complete()
                        complete_evt = TurnCompleteEvent()
                        await websocket.send_text(complete_evt.model_dump_json())
                        logger.info("Sent turn_complete event to client")

                    elif t == "input_transcript":
                        text = item.get("text", "").strip()
                        is_final = item.get("is_final", False)
                        if not text:
                            continue
                        if not is_final:
                            session.append_user_speech(text)
                            evt = TranscriptEvent(
                                role="user",
                                text=session.get_current_user_turn() or text,
                                is_final=False,
                                language=language,
                                timestamp=datetime.now(timezone.utc).isoformat(),
                                status="in_progress"
                            )
                            await websocket.send_text(evt.model_dump_json())
                        else:
                            final_text = session.finalize_user_turn(override_text=text) or text
                            # Deduplicate identical consecutive finalized user message
                            if session.transcripts and len(session.transcripts) >= 2 and session.transcripts[-2].get("role") == "user" and session.transcripts[-2].get("text") == final_text and session.transcripts[-2].get("is_final"):
                                continue

                            # Dynamically adapt language if user speaks in another language
                            detected_curr_lang = detect_text_language(final_text)
                            if detected_curr_lang and detected_curr_lang != language:
                                logger.info(f"[VOICE] User/Candidate interaction language switched to: {detected_curr_lang}")
                                language = detected_curr_lang
                                if hasattr(provider, "language"):
                                    provider.language = detected_curr_lang

                            evt = TranscriptEvent(
                                role="user",
                                text=final_text,
                                is_final=True,
                                language=language,
                                timestamp=datetime.now(timezone.utc).isoformat(),
                                status="finalized"
                            )
                            await websocket.send_text(evt.model_dump_json())
                            if conv_id:
                                try:
                                    conversation_repository.add_message(conv_id, "user", f"🎤 Spoken: {final_text}")
                                except Exception as e:
                                    logger.warning(f"Failed to record spoken user message: {e}")
                            if interview_session_id:
                                try:
                                    sess = interview_repository.get_session(interview_session_id)
                                    if sess:
                                        t_list = sess.get("transcript", [])
                                        if not (t_list and t_list[-1].get("speaker") == "user" and t_list[-1].get("text") == final_text):
                                            t_list.append({
                                                "speaker": "user",
                                                "text": final_text,
                                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                                "language": language
                                            })
                                            interview_repository.update_transcript(interview_session_id, t_list)
                                except Exception as e:
                                    logger.warning(f"Failed to record interview user turn: {e}")

                    elif t == "output_transcript":
                        text = item.get("text", "").strip()
                        is_final = item.get("is_final", False)
                        if not text or is_internal_orchestration_message(text):
                            continue
                        if not is_final:
                            evt = TranscriptEvent(
                                role="agent",
                                text=text,
                                is_final=False,
                                language=language,
                                timestamp=datetime.now(timezone.utc).isoformat(),
                                status="in_progress"
                            )
                            await websocket.send_text(evt.model_dump_json())
                        else:
                            final_agent_text = session.finalize_agent_turn(override_text=text) or text
                            if not final_agent_text or is_internal_orchestration_message(final_agent_text):
                                continue
                            if session.transcripts and len(session.transcripts) >= 2 and session.transcripts[-2].get("role") == "agent" and session.transcripts[-2].get("text") == final_agent_text and session.transcripts[-2].get("is_final"):
                                continue
                            evt = TranscriptEvent(
                                role="agent",
                                text=final_agent_text,
                                is_final=True,
                                language=language,
                                timestamp=datetime.now(timezone.utc).isoformat(),
                                status="finalized"
                            )
                            await websocket.send_text(evt.model_dump_json())
                            if conv_id:
                                try:
                                    conversation_repository.add_message(conv_id, "assistant", final_agent_text)
                                except Exception as e:
                                    logger.warning(f"Failed to record spoken agent message: {e}")
                            if interview_session_id:
                                try:
                                    sess = interview_repository.get_session(interview_session_id)
                                    if sess:
                                        t_list = sess.get("transcript", [])
                                        if not (t_list and t_list[-1].get("speaker") == "ai" and t_list[-1].get("text") == final_agent_text):
                                            t_list.append({
                                                "speaker": "ai",
                                                "text": final_agent_text,
                                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                                "language": language
                                            })
                                            interview_repository.update_transcript(interview_session_id, t_list)
                                except Exception as e:
                                    logger.warning(f"Failed to record interview AI turn: {e}")

                    elif t == "internal_event":
                        # Send as an internal telemetry event, NEVER as user or interviewer transcript
                        try:
                            await websocket.send_text(json.dumps({
                                "type": "internal_event",
                                "event": item.get("event", "internal_orchestration"),
                                "detail": item.get("detail", "")
                            }))
                        except Exception:
                            pass

                    elif t == "error":
                        err_evt = ErrorEvent(message=item.get("message", "Provider error"))
                        await websocket.send_text(err_evt.model_dump_json())

        # Run concurrent tasks
        task_a = asyncio.create_task(client_to_provider())
        task_b = asyncio.create_task(provider_to_client())

        done, pending = await asyncio.wait(
            [task_a, task_b],
            return_when=asyncio.FIRST_COMPLETED
        )

        for p in pending:
            p.cancel()

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected by client")
    except asyncio.CancelledError:
        logger.info("WebSocket tasks cancelled")
    except Exception as e:
        logger.error(f"WebSocket session exception: {e}")
        try:
            await websocket.send_text(ErrorEvent(message=str(e)).model_dump_json())
        except Exception:
            pass
    finally:
        if task_a and not task_a.done():
            task_a.cancel()
        if task_b and not task_b.done():
            task_b.cancel()
        if provider:
            await provider.close()
        if session:
            session_manager.remove_session(session.session_id)
        logger.info("Cleaned up WebSocket session")
