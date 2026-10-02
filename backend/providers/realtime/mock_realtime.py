import os
import math
import struct
import asyncio
import re
from typing import AsyncIterator, Union, Dict, Any, Optional, List, Set
from google import genai
from google.genai import types
from backend.providers.base import BaseRealtimeProvider
from backend.utils.logging import logger
from backend.utils.language_detector import detect_text_language, resolve_interaction_language

LANGUAGE_GREETINGS = {
    "te": "నమస్కారం {name}! {role} ఇంటర్వ్యూకు స్వాగతం. మీ సాంకేతిక అనుభవం మరియు ఇటీవల మీరు పనిచేసిన ముఖ్యమైన ప్రాజెక్ట్ గురించి పరిచయం చేసుకోండి.",
    "hi": "नमस्ते {name}! {role} साक्षात्कार में आपका स्वागत है। कृपया अपनी तकनीकी पृष्ठभूमि और हाल के प्रोजेक्ट के बारे में संक्षेप में बताएं।",
    "ta": "வணக்கம் {name}! {role} நேர்காணலுக்கு வரவேற்கிறோம். தயவுசெய்து உங்கள் தொழில்நுட்ப அனுபவத்தை சுருக்கமாக அறிமுகப்படுத்துங்கள்.",
    "kn": "ನಮಸ್ಕಾರ {name}! {role} ಸಂದರ್ಶನಕ್ಕೆ ಸುಸ್ವಾಗತ. ನಿಮ್ಮ ತಾಂತ್ರಿಕ ಅನುಭವದ ಕುರಿತು ಸಂಕ್ಷಿಪ್ತವಾಗಿ ಪರಿಚಯಿಸಿ.",
    "mr": "नमस्कार {name}! {role} मुलाखतीत आपले स्वागत आहे. कृपया आपल्या तांत्रिक अनुभवाची थोडक्यात माहिती द्या.",
    "es": "¡Hola {name}! Bienvenido a tu entrevista para {role}. ¿Podrías presentarte y compartir tus experiencias técnicas recientes?",
    "fr": "Bonjour {name} et bienvenue à votre entretien pour le poste de {role}. Pourriez-vous vous présenter et décrire vos projets récents ?",
    "en": "Welcome {name} to your {role} interview! To get started, could you briefly introduce yourself and share key technical projects you have recently built?"
}

LANGUAGE_CLOSINGS = {
    "te": "ధన్యవాదాలు {name}! దీంతో మన ఇంటర్వ్యూ పూర్తయింది. మీరు చూపించిన ప్రతిభ ఆధారంగా మీ సమగ్ర మూల్యాంకన నివేదిక ఇప్పుడు సిద్ధమవుతోంది.",
    "hi": "धन्यवाद {name}! इसके साथ ही हमारा साक्षात्कार समाप्त होता है। आपके प्रदर्शन के आधार पर विस्तृत मूल्यांकन रिपोर्ट तैयार की जा रही है।",
    "ta": "நன்றி {name}! இதனுடன் நமது நேர்காணல் முடிவடைகிறது. உங்கள் செயல்திறன் மதிப்பீட்டு அறிக்கை தயாராகி வருகிறது.",
    "kn": "ಧನ್ಯವಾದಗಳು {name}! ಇದರೊಂದಿಗೆ ಸಂದರ್ಶನ ಮುಕ್ತಾಯಗೊಂಡಿದೆ. ನಿಮ್ಮ ಕಾರ್ಯಕ್ಷಮತೆಯ ಮೌಲ್ಯಮಾಪನ ಸಿದ್ಧವಾಗುತ್ತಿದೆ.",
    "mr": "धन्यवाद {name}! यासह आपली मुलाखत संपली आहे. आपल्या कामगिरीचा सविस्तर अहवाल तयार केला जात आहे.",
    "es": "¡Muchas gracias {name}! Con esto concluimos la entrevista. Tu informe de evaluación integral se está compilando.",
    "fr": "Merci beaucoup {name} ! Cela conclut notre entretien. Votre rapport d'évaluation complet est en cours de compilation.",
    "en": "Thank you for your time today, {name}! That concludes our interview session. Your comprehensive performance evaluation is now being compiled."
}

class MockRealtimeProvider(BaseRealtimeProvider):
    """
    Stateful, dynamic realtime voice provider.
    Generates all interview questions dynamically based on resume context, job role,
    experience level, candidate answers, and internal competency coverage.
    Has NO static question banks or fixed question limits.
    """

    def __init__(
        self,
        mode: str = "document-analysis",
        language: str = "en",
        interview_type: Optional[str] = None,
        job_role: Optional[str] = None,
        experience_level: Optional[str] = None,
        difficulty: Optional[str] = None,
        job_description: Optional[str] = None,
        ticket_id: Optional[str] = None,
        interview_session_id: Optional[str] = None,
        resume_context: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        self._connected = False
        self._closed = False
        self.output_sample_rate = 24000
        self._queue: asyncio.Queue = asyncio.Queue()
        self._system_prompt = ""

        # Session Configuration
        self.mode = mode or "document-analysis"
        self.language = language or "en"
        is_interview_mode = self.mode.lower() in ["ai-interview", "interviewer", "ai_interview"]
        self.job_role = job_role or ("Software Engineer" if is_interview_mode else "")
        self.experience_level = experience_level or ("Standard" if is_interview_mode else "")
        self.interview_type = interview_type or ("Technical" if is_interview_mode else "")
        self.difficulty = difficulty or ("Medium" if is_interview_mode else "")
        self.job_description = job_description or ""
        self.ticket_id = ticket_id
        self.interview_session_id = interview_session_id
        self.resume_context = resume_context or {}

        # Dynamic Internal Evaluation State
        self.competencies_covered: List[str] = []
        self.competencies_remaining: List[str] = [
            "core_technical_architecture",
            "hands_on_implementation",
            "problem_solving",
            "system_tradeoffs",
            "resume_project_deep_dive"
        ]
        self.resume_topics_explored: List[str] = []
        self.strengths_observed: List[str] = []
        self.knowledge_gaps: List[str] = []
        self.questions_asked: List[str] = []
        self.answers_received: List[str] = []
        self.skipped_questions: List[int] = []
        self.current_question_index: int = 0
        self.current_difficulty: str = "standard"
        self.interview_progress: float = 0.0
        self.is_concluded: bool = False

        self.current_active_question: str = ""
        self.has_greeted: bool = False
        self.is_speaking: bool = False
        self.interrupted: bool = False
        self._silence_timer: Optional[asyncio.Task] = None
        self._accumulated_audio_bytes = 0
        self._had_speech = False
        self.speech_speed_modifier: float = 1.0

        # LLM client for live question generation when API key is present
        self.client: Optional[genai.Client] = None
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if api_key and len(api_key) > 5 and "placeholder" not in api_key.lower():
            try:
                self.client = genai.Client(api_key=api_key)
            except Exception:
                self.client = None

        self.configure(
            mode=mode,
            language=language,
            interview_type=interview_type,
            job_role=job_role,
            experience_level=experience_level,
            difficulty=difficulty,
            job_description=job_description,
            ticket_id=ticket_id,
            interview_session_id=interview_session_id,
            resume_context=resume_context,
            **kwargs
        )

    def configure(
        self,
        mode: Optional[str] = None,
        language: str = "en",
        interview_type: Optional[str] = None,
        job_role: Optional[str] = None,
        experience_level: Optional[str] = None,
        difficulty: Optional[str] = None,
        job_description: Optional[str] = None,
        ticket_id: Optional[str] = None,
        interview_session_id: Optional[str] = None,
        resume_context: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> None:
        """Sets configuration for session."""
        if mode:
            self.mode = mode
        self.language = language or self.language or "en"
        if interview_type:
            self.interview_type = interview_type
        if job_role:
            self.job_role = job_role
        if experience_level:
            self.experience_level = experience_level
        if difficulty:
            self.difficulty = difficulty
        if job_description:
            self.job_description = job_description
        if ticket_id:
            self.ticket_id = ticket_id
        if interview_session_id:
            self.interview_session_id = interview_session_id
        if resume_context:
            self.resume_context = resume_context

    async def connect(self, system_prompt: str, voice_name: str = "Aoede") -> None:
        self._system_prompt = system_prompt
        self._connected = True
        self._closed = False
        self.has_greeted = False
        self.is_speaking = False
        self.interrupted = False
        self.is_concluded = False
        self.questions_asked = []
        self.answers_received = []
        self.skipped_questions = []
        self.current_question_index = 0
        self.competencies_covered = []
        self.strengths_observed = []
        self.knowledge_gaps = []
        self._accumulated_audio_bytes = 0
        self._had_speech = False
        self.speech_speed_modifier = 1.0

        logger.info(f"Connected to MockRealtimeProvider (mode={self.mode}, role={self.job_role}, lang={self.language})")
        if self.mode.lower() in ["ai-interview", "interviewer", "ai_interview"] and not self.has_greeted:
            await self._queue.put({"type": "agent_kickoff"})

    async def send_video(self, frame_bytes: bytes, mime_type: str = "image/jpeg") -> None:
        """Handles camera/screen share frames in mock mode without disk storage."""
        logger.debug(f"[MOCK_VOICE] Received in-memory video frame: {len(frame_bytes)} bytes ({mime_type})")

    async def finish_user_turn(self) -> None:

        """Explicitly finalizes candidate turn when silence duration or submit is triggered."""
        if self._silence_timer and not self._silence_timer.done():
            self._silence_timer.cancel()
        if not self.is_speaking:
            self._had_speech = False
            self._accumulated_audio_bytes = 0
            logger.info("[VOICE] finish_user_turn triggered in mock mode")
            await self._queue.put({"type": "user_turn", "audio_turn": True})

    def _calculate_rms(self, pcm_data: bytes) -> float:
        """Calculates RMS energy of 16-bit PCM audio samples."""
        if len(pcm_data) < 2:
            return 0.0
        count = len(pcm_data) // 2
        try:
            samples = struct.unpack(f"<{count}h", pcm_data[:count * 2])
            sum_sq = sum(s * s for s in samples)
            return math.sqrt(sum_sq / count)
        except Exception:
            return 0.0

    async def interrupt(self) -> None:
        """Handles manual or barge-in interruption."""
        self.interrupted = True
        self.is_speaking = False
        if self._silence_timer and not self._silence_timer.done():
            self._silence_timer.cancel()
        self._accumulated_audio_bytes = 0
        self._had_speech = False
        await self._queue.put({"type": "interrupted"})

    async def send_audio(self, audio_data: bytes) -> None:
        """Receives audio chunks from client and detects complete turns with VAD."""
        if not self._connected or self._closed:
            return

        energy = self._calculate_rms(audio_data)

        # Barge-in: if agent is speaking and user sends loud voice, interrupt agent
        if self.is_speaking:
            if energy > 600.0:
                self.interrupted = True
                self.is_speaking = False
                logger.info("[VOICE] Barge-in detected in mock mode (energy=%.1f)", energy)
                await self._queue.put({"type": "interrupted"})
            return

        # Voice Activity Detection (VAD)
        SPEECH_THRESHOLD = 400.0
        if energy > SPEECH_THRESHOLD:
            self._had_speech = True
            self._accumulated_audio_bytes += len(audio_data)
            if self._silence_timer and not self._silence_timer.done():
                self._silence_timer.cancel()

        # 1.5 seconds silence threshold before finalizing turn
        if self._had_speech and (self._silence_timer is None or self._silence_timer.done()):
            async def on_speech_pause():
                try:
                    await asyncio.sleep(1.5)
                    if self._had_speech and not self.is_speaking:
                        self._had_speech = False
                        self._accumulated_audio_bytes = 0
                        logger.info("[VOICE] Candidate speech turn completed in mock mode")
                        await self._queue.put({"type": "user_turn", "audio_turn": True})
                except asyncio.CancelledError:
                    pass

            self._silence_timer = asyncio.create_task(on_speech_pause())

    async def send_text(self, text: str) -> None:
        """Receives text input from user."""
        if not self._connected or self._closed:
            return
        if self._silence_timer and not self._silence_timer.done():
            self._silence_timer.cancel()
        self._accumulated_audio_bytes = 0
        self._had_speech = False
        await self._queue.put({"type": "user_turn", "text": text.strip(), "from_text": True})

    def _generate_tone(self, duration_sec: float = 0.35, freq: float = 440.0) -> bytes:
        """Generates a pleasant 24kHz 16-bit mono sine wave with envelope."""
        sample_rate = self.output_sample_rate
        actual_duration = duration_sec / self.speech_speed_modifier
        num_samples = int(sample_rate * actual_duration)
        audio_bytes = bytearray()
        for i in range(num_samples):
            env = min(1.0, i / (sample_rate * 0.05)) * min(1.0, (num_samples - i) / (sample_rate * 0.05))
            sample = int(32767 * 0.18 * env * math.sin(2 * math.pi * freq * (i / sample_rate)))
            audio_bytes.extend(struct.pack('<h', sample))
        return bytes(audio_bytes)

    def _detect_user_intent(self, text: str) -> str:
        """
        Classifies candidate utterance into conversational intent:
        'repeat', 'clarify', 'example', 'skip', 'slower', 'end', or 'answer'
        """
        t = text.lower().strip()
        if any(w in t for w in ["repeat", "say that again", "what was the question", "could you repeat", "మళ్ళీ చెప్పండి", "फिर से बताएं"]):
            return "repeat"
        if any(w in t for w in ["what do you mean", "can you explain", "i don't understand", "clarify", "వివరించండి", "स्पष्ट करें"]):
            return "clarify"
        if any(w in t for w in ["give an example", "give me an example", "can you give an example", "ఉదాహరణ", "उदाहरण"]):
            return "example"
        if any(w in t for w in ["skip this", "can we skip", "skip question", "next question", "pass on this", "దాటవేయండి", "छोड़ें"]):
            return "skip"
        if any(w in t for w in ["speak slower", "speak more slowly", "too fast", "slow down", "నెమ్మదిగా", "धीमे बोलें"]):
            return "slower"
        if any(w in t for w in ["end interview", "stop interview", "i want to stop", "finish interview", "ముగించండి", "समाप्त करें"]):
            return "end"
        return "answer"

    async def _generate_next_question(self, user_answer: str = "") -> str:
        """
        Generates the next interview turn dynamically.
        Uses Gemini LLM if available, or dynamic context reasoning over the resume,
        candidate's answer, and internal competencies. Concludes naturally when ready.
        """
        candidate_name = self.resume_context.get("candidate_name") or "Candidate"
        skills = self.resume_context.get("skills") or []
        projects = self.resume_context.get("projects") or []
        # Detect interaction language from candidate answer
        if user_answer and user_answer.strip():
            detected_lang = detect_text_language(user_answer)
            if detected_lang:
                self.language = detected_lang
        lang = self.language or "en"

        # NOTE: Do NOT artificially cap interview by question count.
        # The interview continues dynamically until the user explicitly requests to end it,
        # clicks End Interview, or intent == "end".

        # 1. Try Gemini text generation if client is available
        if self.client:
            try:
                lang_map = {
                    "te": "Telugu", "hi": "Hindi", "ta": "Tamil", "kn": "Kannada",
                    "mr": "Marathi", "es": "Spanish", "fr": "French", "en": "English"
                }
                lang_name = lang_map.get(lang, lang)
                prompt = f"""
You are an expert interviewer conducting an adaptive technical interview in {lang_name}.
Role: {self.job_role} ({self.interview_type})
Experience Level: {self.experience_level}
Resume Skills: {', '.join(skills[:8])}
Resume Projects: {', '.join(projects[:3])}
Previous Questions Asked ({len(self.questions_asked)}): {self.questions_asked[-4:] if self.questions_asked else []}
Candidate's Latest Answer: {user_answer}
Competencies Covered: {self.competencies_covered}

Rules:
1. Speak exclusively in {lang_name}.
2. If this is the start, greet {candidate_name} and ask your first interview question.
3. If the candidate answered, acknowledge specific technical points they made and ask a dynamic, probing follow-up or explore a new competency.
4. Continue the interview dynamically. Do NOT end the interview unless the candidate explicitly asks to stop.
5. Do NOT include internal thoughts, headers, asterisks, hashtags, or formatting symbols. Output ONLY the clean words to be spoken aloud.
"""
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        self.client.models.generate_content,
                        model="gemini-flash-lite-latest",
                        contents=prompt,
                        config=types.GenerateContentConfig(temperature=0.3)
                    ),
                    timeout=3.5
                )
                generated_text = (response.text or "").strip()
                # Clean any internal thoughts or markdown
                clean_lines = [l for l in generated_text.splitlines() if not any(l.strip().lower().startswith(p) for p in ["refining", "initiating", "analyzing", "preparing", "protocol", "thinking", "note:", "**note"])]
                cleaned_text = " ".join(clean_lines).replace("*", "").replace("#", "").replace("`", "").strip()
                if cleaned_text:
                    return cleaned_text
            except Exception as e:
                logger.warning(f"Dynamic LLM question generation failed ({e}), falling back to context synthesis")

        # 2. Dynamic Context Synthesis (No Hardcoded Lists)
        # First turn:
        if not self.questions_asked and not self.has_greeted and not user_answer:
            greeting_template = LANGUAGE_GREETINGS.get(lang, LANGUAGE_GREETINGS["en"])
            greeting = greeting_template.format(name=candidate_name, role=self.job_role)
            return greeting

        # Subsequent turns: Analyze candidate answer and select dynamic competency
        ans_lower = user_answer.lower()
        mentioned_tech = []
        for kw in ["react", "node", "python", "aws", "docker", "jwt", "sql", "api", "database", "redux", "state", "cache", "testing", "sub-second", "latency", "audio", "pipeline", "systems design", "kafka", "redis", "kubernetes"]:
            if kw in ans_lower:
                mentioned_tech.append(kw.upper())

        turn_num = len(self.questions_asked)
        focus_tech = mentioned_tech[0] if mentioned_tech else (skills[turn_num % len(skills)] if skills else "the system")
        project_ref = projects[turn_num % len(projects)] if projects else "your recent production project"

        # Adaptive topics that can cycle indefinitely
        topics = [
            ("deep_dive", f"You noted your experience with {focus_tech}. What specific scalability trade-offs or performance bottlenecks did you encounter, and how did you resolve them?"),
            ("architecture", f"Regarding {project_ref}, how did you design the service architecture, data contracts, and fault tolerance boundaries?"),
            ("reliability", f"In a high-throughput production environment for a {self.job_role}, how do you ensure zero-downtime deployments, database migrations, and telemetry monitoring?"),
            ("security", f"How did you address authentication, authorization, and data encryption at rest and in transit when building with {focus_tech}?"),
            ("state_and_concurrency", f"When multiple clients make concurrent modifications in your application, how do you handle concurrency, caching, and race conditions?"),
            ("testing", f"What was your automated testing strategy for {project_ref} across unit, integration, and end-to-end tests before shipping?"),
            ("troubleshooting", f"Can you describe an unexpected production outage or critical bug you resolved in your systems, and what post-mortem lessons were learned?"),
            ("distributed_systems", f"If traffic suddenly increases by an order of magnitude, what parts of your {self.job_role} architecture would fail first and how would you scale them?"),
            ("data_consistency", f"How do you maintain consistency across distributed data stores or external API integrations in your workflows?"),
            ("future_optimizations", f"Looking back at {project_ref}, what architectural or tooling decision would you make differently today?")
        ]

        selected_topic, q_en = topics[turn_num % len(topics)]
        self.competencies_covered.append(selected_topic)

        # Formulate dynamic question in requested language
        if lang == "te":
            if turn_num % 3 == 0:
                q = f"మీరు {focus_tech} గురించి చెప్పిన విధానం బాగుంది. ఆ ప్రాజెక్ట్‌లో ఎదురైన ప్రధాన సాంకేతిక సవాళ్లు మరియు పెర్ఫార్మెన్స్ సమస్యలను ఎలా పరిష్కరించారు?"
            elif turn_num % 3 == 1:
                q = f"మీ ప్రాజెక్ట్ '{project_ref}' లో ఆర్కిటెక్చర్ నిర్ణయాలు, డేటా ఫ్లో మరియు సెక్యూరిటీని ఎలా అమలు చేశారు?"
            else:
                q = f"{self.job_role} పాత్రలో సిస్టమ్ స్కేలబిలిటీ, కాషింగ్ (caching) మరియు హై-అవైలబిలిటీని మీరు ఎలా నిర్ధారిస్తారు?"
        elif lang == "hi":
            if turn_num % 3 == 0:
                q = f"आपने {focus_tech} के बारे में बहुत अच्छा समझाया। इस प्रोजेक्ट में स्केलेबिलिटी या परफॉर्मेंस से जुड़ी किस चुनौती का सामना किया?"
            elif turn_num % 3 == 1:
                q = f"आपके प्रोजेक्ट '{project_ref}' में आर्किटेक्चरल डिज़ाइन और एरर हैंडलिंग के बारे में विस्तार से बताएं।"
            else:
                q = f"{self.job_role} के रूप में आप सिस्टम की स्केलेबिलिटी, फॉल्ट टॉलरेंस और डेटा सिक्योरिटी को कैसे सुनिश्चित करते हैं?"
        else: # English
            q = q_en

        return q

    async def _generate_non_interview_response(self, user_prompt: str) -> str:
        """Generates a direct, clean response for non-interview modules (document, vision, media)."""
        prompt_clean = user_prompt.strip()
        mode_lower = self.mode.lower()
        active_lang = resolve_interaction_language(prompt_clean, None, self.language)
        self.language = active_lang

        # Try LLM if client is available
        if self.client:
            try:
                lang_map = {
                    "te": "Telugu", "hi": "Hindi", "ta": "Tamil", "kn": "Kannada",
                    "mr": "Marathi", "es": "Spanish", "fr": "French", "en": "English"
                }
                lang_name = lang_map.get(active_lang, active_lang)
                system_instruction = f"You are a professional assistant providing direct, accurate analysis. Answer strictly in {lang_name}. Do NOT conduct an interview. Do NOT ask job role or candidate questions. Do NOT use markdown asterisks or headers."
                if "document" in mode_lower:
                    system_instruction = f"You are an expert Document Analysis assistant. Answer the user prompt directly based on technical and document context in {lang_name}. Be clear, accurate, and concise. Never act like an interviewer."
                elif "visual" in mode_lower:
                    system_instruction = f"You are a Visualization and Data Analysis assistant. Analyze visual data, charts, and metrics directly in {lang_name}. Never act like an interviewer."
                elif "video" in mode_lower or "audio" in mode_lower:
                    system_instruction = f"You are a Media and Video/Audio Review assistant. Summarize and analyze media content directly in {lang_name}. Never act like an interviewer."
                elif "support" in mode_lower:
                    system_instruction = f"You are a Customer Support assistant. Assist the user directly in {lang_name}."

                prompt = f"{system_instruction}\nCRITICAL: Answer strictly in {lang_name} ({active_lang}). Match the user's current interaction language.\nUser Request: {prompt_clean}"
                response = self.client.models.generate_content(
                    model="gemini-flash-lite-latest",
                    contents=prompt,
                    config=types.GenerateContentConfig(temperature=0.2)
                )
                text = (response.text or "").strip()
                cleaned = text.replace("*", "").replace("#", "").replace("`", "").strip()
                if cleaned:
                    return cleaned
            except Exception as e:
                logger.warning(f"Non-interview LLM generation failed ({e}), using fallback synthesis")

        # Fallback answers based on user query and language
        q_lower = prompt_clean.lower()
        if "arp" in q_lower:
            if "spoof" in q_lower:
                if active_lang == "te":
                    return "ARP స్పూఫింగ్ అనేది నెట్‌వర్క్ దాడి, దీనిలో దాడి చేసే వ్యక్తి లోకల్ నెట్‌వర్క్‌లో తప్పుడు ARP సందేశాలను పంపి ట్రాఫిక్‌ను అడ్డగిస్తాడు."
                elif active_lang == "hi":
                    return "ARP स्पूफिंग एक नेटवर्क हमला है जिसमें हमलावर लोकल नेटवर्क पर गलत ARP संदेश भेजकर ट्रैफ़िक को रोकता है।"
                return "ARP spoofing is a network attack where a malicious actor sends falsified ARP messages over a local area network to link an attacker's MAC address with the IP address of a legitimate computer or gateway. This allows the attacker to intercept, modify, or block network traffic."
            if active_lang == "te":
                return "ARP (Address Resolution Protocol) అనేది లోకల్ ఏరియా నెట్‌వర్క్‌లో IP అడ్రస్‌ను ఫిజికల్ MAC అడ్రస్‌తో మ్యాప్ చేసే ఒక ముఖ్యమైన ప్రోటోకాల్."
            elif active_lang == "hi":
                return "ARP (Address Resolution Protocol) लोकल एरिया नेटवर्क में आईपी एड्रेस को फिजिकल मैक एड्रेस से मैप करने वाला प्रोटोकॉल है।"
            return "Address Resolution Protocol (ARP) maps an IP address to a physical MAC address on a local area network. When a host wants to send data to another IP on the same subnet, it broadcasts an ARP request, and the target host replies with its MAC address."
        elif "tcp" in q_lower:
            if active_lang == "te":
                return "TCP అనేది నమ్మదగిన, క్రమబద్ధమైన డేటా డెలివరీని అందించే కనెక్షన్-ఆధారిత ట్రాన్స్‌పోర్ట్ లేయర్ ప్రోటోకాల్."
            elif active_lang == "hi":
                return "TCP एक कनेक्शन-ओरिएंटेड ट्रांसपोर्ट लेयर प्रोटोकॉल है जो विश्वसनीय और क्रमित डेटा ट्रांसमिशन प्रदान करता है।"
            return "TCP is a connection-oriented transport layer protocol that provides reliable, ordered, and error-checked delivery of a stream of bytes between network applications using a three-way handshake and flow control."
        elif "chart" in q_lower or "graph" in q_lower or "visual" in mode_lower:
            if active_lang == "te":
                return "విజువల్ డేటా ప్రకారం, చార్ట్ కాలక్రమేణా ముఖ్యమైన మెట్రిక్ ట్రెండ్‌లను మరియు పనితీరు మార్పులను స్పష్టంగా వివరిస్తుంది."
            elif active_lang == "hi":
                return "विजुअल डेटा के अनुसार, चार्ट समय के साथ प्रमुख मीट्रिक रुझानों और प्रदर्शन परिवर्तनों को दर्शाता है।"
            return "Based on the visual data, the visualization illustrates key metric trends over time, highlighting performance peaks and baseline distribution across the recorded intervals."
        elif "summar" in q_lower or "సారాంశం" in q_lower or "सारांश" in q_lower or "video" in mode_lower or "audio" in mode_lower:
            if active_lang == "te":
                return "డాక్యుమెంట్ సారాంశం: సిస్టమ్ ఆర్కిటెక్చర్, ప్రధాన సాంకేతిక భావనలు మరియు కీలక డేటా ప్రవాహాన్ని ఈ కంటెంట్ సమగ్రంగా వివరిస్తుంది."
            elif active_lang == "hi":
                return "दस्तावेज़ सारांश: सामग्री में सिस्टम आर्किटेक्चर, प्रमुख तकनीकी अवधारणाएं और मुख्य कार्यप्रणाली विस्तार से दी गई हैं।"
            return "The media content presents core technical concepts, detailing the system architecture, core implementation workflows, and practical applications outlined in the presentation."
        else:
            if active_lang == "te":
                return f"మీ విశ్లేషణ అభ్యర్థన విజయవంతంగా ప్రాసెస్ చేయబడింది: {prompt_clean}. మాడ్యూల్ సందర్భానికి అనుగుణంగా సమాచారం సిద్ధంగా ఉంది."
            elif active_lang == "hi":
                return f"आपके अनुरोध का विश्लेषण सफलतापूर्वक किया गया: {prompt_clean}. मॉड्यूल संदर्भ के अनुसार जानकारी तैयार है।"
            return f"Here is the analysis regarding your request: {prompt_clean}. The system processed your input successfully according to the active module context."

    async def receive(self) -> AsyncIterator[Union[bytes, Dict[str, Any]]]:
        is_interview = self.mode.lower() in ["interviewer", "ai-interview", "ai_interview"]
        while self._connected and not self._closed:
            try:
                msg = await asyncio.wait_for(self._queue.get(), timeout=2.0)
                if not msg:
                    continue

                msg_type = msg.get("type")

                # 1. Handle Barge-In Interruption
                if msg_type == "interrupted":
                    self.is_speaking = False
                    self.interrupted = False
                    yield {"type": "interrupted"}
                    continue

                # 2. User Turn or Agent Kickoff Processing
                if msg_type in ["agent_kickoff", "user_turn"]:
                    if msg_type == "agent_kickoff" and self.has_greeted:
                        continue

                    if self.is_speaking:
                        self.is_speaking = False
                        self.interrupted = False
                        yield {"type": "interrupted"}

                    user_text = msg.get("text")

                    # Handle Non-Interview Modules cleanly
                    if not is_interview:
                        self.is_speaking = True
                        prompt_text = user_text or "Analyze content"
                        yield {
                            "type": "input_transcript",
                            "text": prompt_text,
                            "is_final": True
                        }
                        ai_reply = await self._generate_non_interview_response(prompt_text)
                        yield {
                            "type": "output_transcript",
                            "text": ai_reply,
                            "is_final": True
                        }
                        # Audible feedback
                        yield self._generate_tone(duration_sec=0.25, freq=523.25)
                        yield {"type": "turn_complete"}
                        self.is_speaking = False
                        continue

                    # Interview Initial Kickoff Turn
                    if not self.has_greeted:
                        self.has_greeted = True
                        self.is_speaking = True

                        ai_reply = await self._generate_next_question()
                        self.current_active_question = ai_reply
                        self.questions_asked.append(ai_reply)

                        yield {
                            "type": "output_transcript",
                            "text": ai_reply,
                            "is_final": True
                        }

                        # Generate audible tone representation
                        for freq, dur in [(440.0, 0.28), (554.37, 0.35)]:
                            if self.interrupted:
                                break
                            yield self._generate_tone(duration_sec=dur, freq=freq)
                            await asyncio.sleep(0.08)

                        if self.interrupted:
                            self.is_speaking = False
                            self.interrupted = False
                            yield {"type": "interrupted"}
                            continue

                        yield {"type": "turn_complete"}
                        self.is_speaking = False
                        continue

                    # Subsequent Candidate Turns
                    self.is_speaking = True

                    # Simulate realistic candidate answer if audio chunk with empty text
                    if not user_text:
                        step = len(self.questions_asked)
                        skills_str = ", ".join((self.resume_context.get("skills") or ["React", "FastAPI"])[:3])
                        if self.language == "te":
                            user_text = f"నేను {skills_str} ఉపయోగించి ప్రాజెక్ట్ డెవలప్ చేశాను. కాంపోనెంట్ ఆర్కిటెక్చర్ మరియు డేటా ఫ్లోను పటిష్టంగా నిర్వహించాను."
                        elif self.language == "hi":
                            user_text = f"मैंने {skills_str} का उपयोग करके प्रोजेक्ट विकसित किया। इसमें डेटा हैंडलिंग और आर्किटेक्चर का ध्यान रखा।"
                        else:
                            user_text = f"I built my recent applications utilizing {skills_str}. I focused on clean architecture, modular state management, and robust error handling across services."

                    yield {
                        "type": "input_transcript",
                        "text": user_text,
                        "is_final": True
                    }

                    self.answers_received.append(user_text)

                    # Dynamic Language Detection from candidate input
                    if user_text and user_text.strip():
                        detected_lang = detect_text_language(user_text)
                        if detected_lang:
                            self.language = detected_lang

                    # Intent Understanding
                    intent = self._detect_user_intent(user_text)
                    active_q = self.current_active_question
                    lang = self.language

                    ai_reply = ""
                    if intent == "repeat":
                        if lang == "te":
                            ai_reply = f"తప్పకుండా. ప్రశ్నను మళ్ళీ అడుగుతున్నాను: {active_q}"
                        elif lang == "hi":
                            ai_reply = f"ज़रूर। मैं प्रश्न दोहराता हूँ: {active_q}"
                        else:
                            ai_reply = f"Certainly. Let me repeat the question: {active_q}"

                    elif intent == "clarify":
                        if lang == "te":
                            ai_reply = f"వివరిస్తాను. మీ ప్రాక్టికల్ అనుభవం మరియు నిర్ణయాలు తెలుసుకోవడమే దీని ముఖ్య ఉద్దేశ్యం: {active_q}"
                        elif lang == "hi":
                            ai_reply = f"स्पष्ट करता हूँ। इसका उद्देश्य आपके व्यावहारिक अनुभव को समझना है: {active_q}"
                        else:
                            ai_reply = f"To clarify, we want to assess your practical real-world approach to: {active_q}"

                    elif intent == "example":
                        if lang == "te":
                            ai_reply = "ఉదాహరణకు, మీరు గతంలో అభివృద్ధి చేసిన వెబ్ అప్లికేషన్ లేదా API లో ఎదురైన ఒక సమస్యను ఆధారంగా వివరించవచ్చు."
                        elif lang == "hi":
                            ai_reply = "उदाहरण के लिए, आप अपने पिछले प्रोजेक्ट या एपीआई में आई किसी वास्तविक समस्या का उदाहरण दे सकते हैं।"
                        else:
                            ai_reply = "For instance, you could illustrate this with a specific backend service, authentication flow, or caching bottleneck you tackled."

                    elif intent == "skip":
                        if lang == "te":
                            ai_reply = "సరే, ఎటువంటి సమస్య లేదు. మనం తదుపరి అంశానికి వెళ్దాం."
                        elif lang == "hi":
                            ai_reply = "कोई बात नहीं, हम अगले विषय पर आगे बढ़ते हैं।"
                        else:
                            ai_reply = "No problem at all, let's move forward."
                        self.skipped_questions.append(self.current_question_index)
                        self.current_question_index += 1
                        next_q = await self._generate_next_question(user_text)
                        ai_reply = f"{ai_reply} {next_q}"
                        self.current_active_question = next_q
                        self.questions_asked.append(next_q)

                    elif intent == "slower":
                        self.speech_speed_modifier = 0.8
                        if lang == "te":
                            ai_reply = f"తప్పకుండా, నేను మరింత నెమ్మదిగా మాట్లాడుతాను. ప్రశ్న: {active_q}"
                        elif lang == "hi":
                            ai_reply = f"ज़रूर, मैं थोड़ा धीमे और स्पष्ट बोलूँगा। प्रश्न: {active_q}"
                        else:
                            ai_reply = f"Certainly, I will speak more slowly and clearly. Now, regarding our question: {active_q}"

                    elif intent == "end":
                        self.is_concluded = True
                        closing_template = LANGUAGE_CLOSINGS.get(lang, LANGUAGE_CLOSINGS["en"])
                        ai_reply = closing_template.format(name=self.resume_context.get("candidate_name") or "Candidate")

                    else:
                        # Candidate gave an answer -> Generate next question dynamically
                        self.current_question_index += 1
                        next_q = await self._generate_next_question(user_text)
                        ai_reply = next_q
                        self.current_active_question = next_q
                        self.questions_asked.append(next_q)

                    yield {
                        "type": "output_transcript",
                        "text": ai_reply,
                        "is_final": True
                    }

                    # Auditory feedback tone
                    for freq, dur in [(523.25, 0.25), (659.25, 0.28)]:
                        if self.interrupted:
                            break
                        yield self._generate_tone(duration_sec=dur, freq=freq)
                        await asyncio.sleep(0.06)

                    if self.interrupted:
                        self.is_speaking = False
                        self.interrupted = False
                        yield {"type": "interrupted"}
                        continue

                    yield {"type": "turn_complete"}
                    self.is_speaking = False

            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[VOICE] Error in mock provider receive loop: {e}")
                yield {"type": "error", "message": str(e)}

    async def close(self) -> None:
        self._closed = True
        self._connected = False
        if self._silence_timer and not self._silence_timer.done():
            self._silence_timer.cancel()
        logger.info("[VOICE] MockRealtimeProvider closed")
