import os
import re
import json
import base64
import asyncio
from typing import Optional, List, Dict, Any, Tuple
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from google import genai
from google.genai import types

from backend.repositories.conversation_repository import conversation_repository, normalize_feature_id
from backend.repositories.ticket_repository import ticket_repository
from backend.utils.auth_deps import get_current_user_optional
from backend.utils.logging import logger
from backend.utils.language_detector import resolve_interaction_language

router = APIRouter(prefix="/api/chat", tags=["chat"])

GEMINI_CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash"
]

LANGUAGE_PROMPT_INSTRUCTIONS = {
    "te": "Respond naturally in fluent Telugu (తెలుగు). Use Telugu script. Keep code, programming syntax, proper nouns, and technical terms in English while explaining concepts thoroughly in Telugu.",
    "hi": "Respond naturally in fluent Hindi (हिन्दी). Use Devanagari script. Keep programming syntax, variables, and technical terms in English, explaining concepts conversationally in Hindi.",
    "kn": "Respond naturally in Kannada (ಕನ್ನಡ). Use Kannada script. Do NOT translate into English or Hindi. Preserve technical terms and keep programming code unchanged while explaining in Kannada.",
    "mr": "Respond naturally in Marathi (मराठी). Use Devanagari script with proper Marathi grammar and vocabulary. Do NOT default to Hindi or English. Preserve code and technical terms.",
    "ta": "Respond naturally in fluent Tamil (தமிழ்). Use Tamil script. Keep code and technical terminology intact while explaining concepts clearly in Tamil.",
    "ml": "Respond naturally in fluent Malayalam (മലയാളം). Use Malayalam script. Retain programming code and technical terms in English while explaining in Malayalam.",
    "bn": "Respond naturally in fluent Bengali (বাংলা). Use Bengali script. Retain technical terms and code while explaining in clear, articulate Bengali.",
    "gu": "Respond naturally in fluent Gujarati (ગુજરાતી). Use Gujarati script. Keep technical terms and code in English while explaining concepts in Gujarati.",
    "pa": "Respond naturally in fluent Punjabi (ਪੰਜਾਬੀ). Use Gurmukhi script. Retain technical terms in English while explaining in Punjabi.",
    "ur": "Respond naturally in fluent Urdu (اردو). Use Urdu script. Keep code and technical terminology in English while providing clear Urdu explanations.",
    "es": "Respond naturally in fluent Spanish (Español). Keep technical terms and programming code in original English without translating syntax.",
    "fr": "Respond naturally in fluent French (Français). Preserve programming code and technical terminology in English.",
    "de": "Respond naturally in fluent German (Deutsch). Retain code, syntax, and standard technical terms in English.",
    "ja": "Respond naturally in fluent Japanese (日本語). Use appropriate politeness (Desu/Masu). Keep code and programming terminology in English.",
    "ko": "Respond naturally in fluent Korean (한국어). Use polite speech (Haeyo-che). Keep code and technical terms intact in English.",
    "zh": "Respond naturally in fluent Simplified Chinese (简体中文). Keep code and programming syntax in original English.",
    "en": "Respond in clear, natural, professional English."
}

LANGUAGE_NAMES = {
    "te": "Telugu (తెలుగు)",
    "hi": "Hindi (हिन्दी)",
    "kn": "Kannada (ಕನ್ನಡ)",
    "mr": "Marathi (मराठी)",
    "ta": "Tamil (தமிழ்)",
    "ml": "Malayalam (മലയാളം)",
    "bn": "Bengali (বাংলা)",
    "gu": "Gujarati (ગુજરાતી)",
    "pa": "Punjabi (ਪੰਜਾਬੀ)",
    "ur": "Urdu (اردو)",
    "es": "Spanish (Español)",
    "fr": "French (Français)",
    "de": "German (Deutsch)",
    "ja": "Japanese (日本語)",
    "ko": "Korean (한국어)",
    "zh": "Simplified Chinese (简体中文)",
    "en": "English"
}

def build_mandatory_language_instruction(lang_code: str) -> str:
    lang_name = LANGUAGE_NAMES.get(lang_code, "English")
    detail = LANGUAGE_PROMPT_INSTRUCTIONS.get(lang_code, f"Respond naturally in fluent {lang_name}.")
    return (
        f"MANDATORY LANGUAGE ENFORCEMENT:\n"
        f"Respond only in the user's currently selected language.\n"
        f"Respond exclusively in {lang_name}. Do not switch to another language unless the user explicitly changes the application language.\n"
        f"{detail}\n"
        f"Do NOT continue responding in a previously selected language. The user's current authoritative language selection is {lang_name}."
    )

PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "core", "prompts")

FEATURE_PROMPT_FILES = {
    "document-analysis": "document_analysis.md",
    "visual-intelligence": "visual_intelligence.md",
    "ai-interview": "ai_interview.md",
    "customer-support": "customer_support.md",
    "video-audio-review": "video_audio_review.md",
    "data-study": "data_study.md",
}

def get_feature_system_prompt(feature_id: str) -> str:
    canonical = normalize_feature_id(feature_id)
    filename = FEATURE_PROMPT_FILES.get(canonical, "document_analysis.md")
    path = os.path.join(PROMPTS_DIR, filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    return "You are an advanced, specialized multimodal AI assistant."

def clean_for_speech_output(text: str) -> str:
    """Strips raw markdown symbols and formatting so text reads naturally via speech synthesis without saying asterisks, hashes, etc."""
    if not text:
        return ""
    # Strip code blocks
    cleaned = re.sub(r'```[\s\S]*?```', '', text)
    # Strip inline backticks
    cleaned = re.sub(r'`([^`]+)`', r'\1', cleaned)
    # Strip Markdown headers (#, ##, ###)
    cleaned = re.sub(r'^#+\s*', '', cleaned, flags=re.MULTILINE)
    # Strip bold / italic formatting (**text**, *text*, __text__, _text_)
    cleaned = re.sub(r'\*\*([^*]+)\*\*', r'\1', cleaned)
    cleaned = re.sub(r'\*([^*]+)\*', r'\1', cleaned)
    cleaned = re.sub(r'__([^_]+)__', r'\1', cleaned)
    cleaned = re.sub(r'_([^_]+)_', r'\1', cleaned)
    # Strip blockquotes (> quote)
    cleaned = re.sub(r'^\s*>\s*', '', cleaned, flags=re.MULTILINE)
    # Strip bullet points (*, -, +)
    cleaned = re.sub(r'^\s*[\*\-\+]\s+', '', cleaned, flags=re.MULTILINE)
    # Strip numbered lists
    cleaned = re.sub(r'^\s*\d+\.\s+', '', cleaned, flags=re.MULTILINE)
    # Strip horizontal separators
    cleaned = re.sub(r'^-{3,}', '', cleaned, flags=re.MULTILINE)
    # Collapse multiple whitespaces and newlines
    cleaned = re.sub(r'\n+', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

class ChatMessageRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: Optional[str] = None
    user_prompt: Optional[str] = None
    language: Optional[str] = "en"
    feature: Optional[str] = "document-analysis"
    feature_id: Optional[str] = None
    module: Optional[str] = None
    input_mode: Optional[str] = "text" # "text" | "voice"
    ticket_id: Optional[str] = None
    document_context: Optional[str] = None
    visual_context: Optional[str] = None
    media_context: Optional[str] = None

def get_gemini_client() -> Optional[genai.Client]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    return genai.Client(api_key=api_key)

def build_file_part(file_record: Dict[str, Any]) -> Optional[Any]:
    file_path = file_record.get("file_path")
    mime_type = file_record.get("mime_type", "")
    filename = file_record.get("filename", "")

    if not file_path or not os.path.exists(file_path):
        logger.warning(f"File not found on disk: {file_path}")
        return None

    try:
        # Check size (inline limits up to 20MB)
        size = os.path.getsize(file_path)
        if size > 25 * 1024 * 1024:
            logger.warning(f"File {filename} exceeds inline size limit ({size} bytes)")
            return None

        # Handle text/csv/json/code files directly as text
        if mime_type.startswith("text/") or filename.endswith((".txt", ".md", ".csv", ".json", ".py", ".js", ".ts", ".html", ".css")):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            return types.Part.from_text(text=f"Attached File [{filename}]:\n{content}")

        # Handle binary files (PDF, Images, Audio) via bytes
        with open(file_path, "rb") as f:
            data = f.read()

        if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
            return types.Part.from_bytes(data=data, mime_type="application/pdf")
        elif mime_type.startswith("image/"):
            return types.Part.from_bytes(data=data, mime_type=mime_type)
        elif mime_type.startswith("audio/"):
            return types.Part.from_bytes(data=data, mime_type=mime_type)
        else:
            return types.Part.from_bytes(data=data, mime_type=mime_type or "application/octet-stream")

    except Exception as e:
        logger.error(f"Error reading file {file_path}: {e}")
        return None

def process_visual_context(visual_context: Optional[str]) -> Tuple[Optional[types.Part], Optional[types.Part], str]:
    """
    Parses visual_context and returns (image_part, text_part, source).
    If real image bytes are present (JSON object with base64, data URL, or raw base64),
    it decodes them and creates types.Part.from_bytes(data=raw_bytes, mime_type=mime_type).
    Returns (image_part, text_part, source).
    """
    if not visual_context or not visual_context.strip():
        return None, None, "none"

    vc_trimmed = visual_context.strip()

    # Case 1: JSON payload (e.g. {"data": "...", "mime_type": "image/jpeg", "source": "camera"})
    if (vc_trimmed.startswith("{") and vc_trimmed.endswith("}")):
        try:
            payload = json.loads(vc_trimmed)
            if isinstance(payload, dict):
                b64_data = payload.get("data") or payload.get("image") or payload.get("frame")
                mime_type = payload.get("mime_type") or payload.get("mimeType") or "image/jpeg"
                source = payload.get("source") or "camera"
                if b64_data and isinstance(b64_data, str):
                    if "," in b64_data:
                        b64_data = b64_data.split(",", 1)[1]
                    raw_bytes = base64.b64decode(b64_data)
                    logger.info(f"[CHAT] Successfully decoded visual frame ({source}): {len(raw_bytes)} bytes, MIME {mime_type}")
                    image_part = types.Part.from_bytes(data=raw_bytes, mime_type=mime_type)
                    source_title = "Screen Sharing" if source == "screen" else ("Camera & Screen" if source == "camera_and_screen" else "Live Camera")
                    text_part = types.Part.from_text(text=f"[{source_title} Frame Attached from User]:")
                    return image_part, text_part, source
        except Exception as e:
            logger.warning(f"[CHAT] Error parsing JSON visual_context: {e}")

    # Case 2: Data URL (e.g. data:image/jpeg;base64,...)
    if vc_trimmed.startswith("data:image/"):
        try:
            header, b64_data = vc_trimmed.split(",", 1)
            mime_type = header.split(";")[0].replace("data:", "").strip()
            raw_bytes = base64.b64decode(b64_data)
            logger.info(f"[CHAT] Successfully decoded data URL visual frame: {len(raw_bytes)} bytes, MIME {mime_type}")
            image_part = types.Part.from_bytes(data=raw_bytes, mime_type=mime_type)
            text_part = types.Part.from_text(text="[Live Camera Frame Attached from User]:")
            return image_part, text_part, "camera"
        except Exception as e:
            logger.warning(f"[CHAT] Error decoding data URL visual_context: {e}")

    # Case 3: Raw base64 string
    if len(vc_trimmed) > 100 and " " not in vc_trimmed:
        try:
            raw_bytes = base64.b64decode(vc_trimmed)
            mime_type = "image/png" if raw_bytes.startswith(b"\x89PNG") else "image/jpeg"
            logger.info(f"[CHAT] Successfully decoded raw base64 visual frame: {len(raw_bytes)} bytes, MIME {mime_type}")
            image_part = types.Part.from_bytes(data=raw_bytes, mime_type=mime_type)
            text_part = types.Part.from_text(text="[Live Camera Frame Attached from User]:")
            return image_part, text_part, "camera"
        except Exception as e:
            logger.warning(f"[CHAT] Error decoding raw base64 visual_context: {e}")

    # Case 4: Plain text context string
    return None, types.Part.from_text(text=f"Active Visual Context:\n{vc_trimmed}"), "text"

import re
from typing import Tuple

def extract_file_text(file_record: Dict[str, Any], max_chars: int = 50000) -> str:
    """Extracts raw text from an attached file (PDF, TXT, CSV, Code, etc.)."""
    file_path = file_record.get("file_path", "")
    filename = file_record.get("filename", "")
    if not file_path or not os.path.exists(file_path):
        return ""

    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            pages_text = []
            for i, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                if txt.strip():
                    pages_text.append(f"--- Page {i+1} ---\n{txt.strip()}")
            return "\n\n".join(pages_text)[:max_chars]
        except Exception as e:
            logger.warning(f"Error reading PDF {filename} with pypdf: {e}")
            return ""
    elif ext in [".txt", ".md", ".csv", ".json", ".py", ".js", ".ts", ".html", ".css", ".doc", ".docx"]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()[:max_chars]
        except Exception as e:
            logger.warning(f"Error reading text file {filename}: {e}")
            return ""
    return ""

def generate_grounded_fallback_response(
    query: str,
    files: List[Dict[str, Any]],
    feature: str = "document-analysis",
    language: str = "en"
) -> str:
    """
    Generates an intelligent, grounded document summary or Q&A response
    from the actual uploaded document text when Gemini is offline or in development mock mode.
    """
    q_lower = query.lower().strip()
    
    # 1. Gather all extracted text from attached files
    doc_sections: List[Tuple[str, str]] = [] # (filename, text)
    for f in files:
        txt = extract_file_text(f)
        if txt:
            doc_sections.append((f.get("filename", "Document"), txt))

    if not doc_sections:
        if language == "te":
            return "మీ విచారణ అందింది. సిస్టమ్ ప్రస్తుతం అభివృద్ధి రీతిలో ఉంది. లైవ్ జెమిని మోడల్స్ కోసం backend/.env లో చెల్లుబాటు అయ్యే GEMINI_API_KEY ని కాన్ఫిగర్ చేయండి."
        elif language == "hi":
            return "आपकी पूछताछ प्राप्त हुई। सिस्टम वर्तमान में विकास मोड में है। लाइव जेमिनी मॉडल के लिए backend/.env में एक वैध GEMINI_API_KEY कॉन्फ़िगर करें।"
        return (
            "I received your inquiry. The system is currently in development mode. "
            "To enable live Gemini multimodal inference across audio, video, and general web queries, "
            "please set a valid `GEMINI_API_KEY` in `backend/.env`."
        )

    primary_name, primary_text = doc_sections[0]
    total_pages = sum(1 for line in primary_text.splitlines() if line.startswith("--- Page "))
    lines = [l.strip() for l in primary_text.splitlines() if l.strip() and not l.startswith("--- Page ")]

    # 2. Check if user is asking for a summary / overview / takeaways
    is_summary = any(w in q_lower for w in [
        "summarize", "summary", "overview", "core takeaways", "main points", "review", "brief",
        "సారాంశం", "ముఖ్యమైన", "వివరించండి", "వివరాలు",
        "सारांश", "मुख्य", "समझाओ", "विवरण", "समीक्षा"
    ])

    sample_bullets = lines[2:15] if len(lines) > 15 else lines[:8]
    summary_points = "\n".join([f"• {b[:90]}..." if len(b) > 90 else f"• {b}" for b in sample_bullets[:5]])

    if is_summary:
        if language == "te":
            return (
                f"📄 డాక్యుమెంట్ సారాంశం: {primary_name}\n\n"
                f"ఫైల్ అవలోకనం: {primary_name} విజయవంతంగా విశ్లేషించబడింది.\n\n"
                f"ముఖ్యమైన అంశాలు:\n{summary_points}\n\n"
                "మీరు నిర్దిష్ట ప్రశ్నలు అడగవచ్చు లేదా ఏదైనా భాగాన్ని వివరించమని కోరవచ్చు."
            )
        elif language == "hi":
            return (
                f"📄 दस्तावेज़ सारांश: {primary_name}\n\n"
                f"फ़ाइल समीक्षा: {primary_name} का सफलतापूर्वक विश्लेषण किया गया।\n\n"
                f"मुख्य बिंदु:\n{summary_points}\n\n"
                "आप किसी विशिष्ट अनुभाग के बारे में प्रश्न पूछ सकते हैं।"
            )
        else:
            return (
                f"📄 Document Summary: {primary_name}\n\n"
                f"File Overview: Successfully parsed {primary_name}"
                f"{f' ({total_pages} pages)' if total_pages > 0 else ''}.\n\n"
                f"Key Concepts & Topics Covered:\n{summary_points}\n\n"
                "The document is loaded and in context. You can now ask specific questions or request a breakdown of any section."
            )

    # 3. Specific Question Answering against the document text
    stop_words = {"what", "are", "the", "in", "is", "a", "an", "of", "and", "or", "to", "for", "with", "this", "tell", "me", "about", "how", "does", "explain"}
    keywords = [w for w in re.findall(r'\b[a-zA-Z0-9_\u0C00-\u0C7F\u0900-\u097F-]{2,}\b', q_lower) if w not in stop_words]

    matched_paragraphs = []
    paragraphs = primary_text.split("\n\n")
    for p in paragraphs:
        p_clean = p.strip()
        if len(p_clean) < 20 or p_clean.startswith("--- Page "):
            continue
        p_lower = p_clean.lower()
        score = sum(1 for kw in keywords if kw in p_lower)
        if score > 0:
            matched_paragraphs.append((score, p_clean))

    matched_paragraphs.sort(key=lambda x: x[0], reverse=True)

    if matched_paragraphs:
        top_matches = matched_paragraphs[:3]
        evidence = "\n\n".join([f"\"{m[1][:250]}...\"" if len(m[1]) > 250 else f"\"{m[1]}\"" for m in top_matches])
        if language == "te":
            return (
                f"అప్‌లోడ్ చేసిన డాక్యుమెంట్ {primary_name} ప్రకారం:\n\n"
                f"{evidence}\n\n"
                f"సమాధానం: మీ ప్రశ్న \"{query}\" కు సంబంధించిన వివరాలు పైన పేర్కొనబడ్డాయి."
            )
        elif language == "hi":
            return (
                f"अपलोड किए गए दस्तावेज़ {primary_name} के अनुसार:\n\n"
                f"{evidence}\n\n"
                f"उत्तर: आपके प्रश्न \"{query}\" से संबंधित मुख्य जानकारी ऊपर प्रस्तुत है।"
            )
        else:
            return (
                f"Based on the uploaded document {primary_name}:\n\n"
                f"{evidence}\n\n"
                f"Answer: According to {primary_name}, the relevant information regarding \"{query}\" is highlighted above."
            )

    # 4. Fallback if no specific keyword match was found in document
    preview_snippet = "\n".join(lines[:4])
    if language == "te":
        return (
            f"డాక్యుమెంట్ {primary_name} ఆధారంగా సమాచారం:\n\n"
            f"{preview_snippet}\n\n"
            f"మీ ప్రశ్న \"{query}\" విశ్లేషించబడింది. మరింత స్పష్టత కోసం సంబంధిత విభాగం గురించి అడగండి."
        )
    elif language == "hi":
        return (
            f"दस्तावेज़ {primary_name} के आधार पर संदर्भ:\n\n"
            f"{preview_snippet}\n\n"
            f"आपके प्रश्न \"{query}\" का विश्लेषण किया गया। आप किसी भी विशिष्ट अनुभाग के बारे में पूछ सकते हैं।"
        )
    return (
        f"Based on {primary_name}, here is the relevant context from the document:\n\n"
        f"{preview_snippet}\n\n"
        f"I analyzed the text for \"{query}\". Feel free to mention specific topics or sections for a deeper breakdown."
    )

@router.post("")
async def send_chat_message(
    req: ChatMessageRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    req_feature = normalize_feature_id(req.module or req.feature_id or req.feature)
    user_text = (req.message or req.user_prompt or "").strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Message or user_prompt is required")

    input_mode = (req.input_mode or "text").lower()

    conv = conversation_repository.get_conversation(req.conversation_id) if req.conversation_id else None
    if not conv:
        # Auto-create if not found strictly with the requested feature and associate with authenticated user
        conv = conversation_repository.create_conversation(
            feature=req_feature,
            language=req.language or "en",
            user_id=user["id"] if user else ""
        )
        req.conversation_id = conv["id"]

    # Verify conversation feature matches or update to requested feature
    conv_feature = normalize_feature_id(conv.get("feature"))

    # Save user message to database
    conversation_repository.add_message(
        conv_id=req.conversation_id,
        role="user",
        content=user_text
    )

    # Check if we should generate a title
    if conv.get("title") in ["New Conversation", "Conversation", None]:
        attached_files = conv.get("files", [])
        fn = attached_files[0]["filename"] if attached_files else None
        conversation_repository.generate_smart_title(
            conv_id=req.conversation_id,
            first_message=user_text,
            filename=fn
        )

    attached_files = conv.get("files", [])
    client = get_gemini_client()

    # Resolve current user interaction language with strict priority:
    # 1. Current user prompt language (detected from script/text)
    # 2. Explicit requested language
    # 3. Existing session language
    active_lang = resolve_interaction_language(user_text, req.language, conv.get("language"))
    lang_instruction = build_mandatory_language_instruction(active_lang)

    if not client:
        # Grounded fallback using uploaded document text or development mock
        fallback_reply = generate_grounded_fallback_response(
            query=user_text,
            files=attached_files,
            feature=conv_feature,
            language=active_lang
        )
        conversation_repository.add_message(req.conversation_id, "assistant", fallback_reply)
        clean_voice = clean_for_speech_output(fallback_reply) if input_mode == "voice" else None
        return {
            "response": fallback_reply,
            "clean_voice_response": clean_voice,
            "conversation_id": req.conversation_id,
            "feature_id": conv_feature,
            "module": conv_feature,
            "input_mode": input_mode,
            "language": active_lang
        }

    # Build feature-isolated system instruction
    feature_prompt = get_feature_system_prompt(conv_feature)

    ticket_prompt = ""
    if req.ticket_id:
        try:
            ticket_prompt = ticket_repository.get_ticket_context_prompt(req.ticket_id)
        except Exception:
            pass

    voice_instruction = ""
    if input_mode == "voice":
        voice_instruction = (
            "6. VOICE RESPONSE MODE: The user dictated this prompt via voice. "
            "Formulate a direct, natural spoken response. Do NOT use markdown symbols, asterisks, hashtags, or bullet syntax "
            "so the response sounds completely natural when spoken."
        )
    else:
        voice_instruction = "6. TEXT RESPONSE MODE: Deliver clear, well-structured text for display in the workspace."

    system_instruction = (
        f"{feature_prompt}\n\n"
        f"ACTIVE MODULE: {conv_feature.upper()}\n"
        f"{lang_instruction}\n\n"
        f"{ticket_prompt}\n"
        "STRICT INSTRUCTIONS:\n"
        "1. COMPLETE MODULE ISOLATION: Answer strictly based ONLY on the attached files and conversation history belonging to this specific workspace. Do NOT reference outside materials, past sessions, or other feature domains.\n"
        "2. ABSOLUTELY NO INTERVIEW BEHAVIOR: Unless this module is explicitly 'ai-interview', you must NEVER act as an interviewer, never ask software engineering interview questions, never ask about job roles, experience, or resumes, and never conduct an interview.\n"
        "3. GROUNDING: If files are attached, analyze and answer strictly based on the actual contents of the uploaded files. Do NOT provide generic placeholder answers. Give concrete, accurate explanations.\n"
        "4. SCRIPT FIDELITY: When responding in Indian languages (Telugu, Hindi, Kannada, Marathi, Tamil, Bengali, Malayalam, Gujarati, Punjabi, Urdu), write exclusively in authentic native script.\n"
        "5. CODE PRESERVATION: Preserve programming code, syntax, identifiers in original English without translating code snippets.\n"
        f"{voice_instruction}\n"
        "7. DIRECT INTENT FULFILLMENT: Directly answer the user's specific request without adding unwanted rapid-fire viva, interview questions, or grading rubrics.\n"
        "8. VISUAL & SCREEN BOUNDARIES: If this is customer support, when an active camera image or screen share frame is attached to the request, you have genuine visual access to that frame — analyze and describe what you see (the person, held objects, screen content, error messages, devices, etc.) directly, accurately, and naturally. However, if NO camera or screen share image is attached and the user asks whether you can see their camera or screen, clarify politely: 'I cannot access your screen unless you choose to share it' or 'I cannot see your camera right now, as no camera data has been provided'."
    )

    # Build contents strictly with files from THIS conversation only
    contents: List[Any] = []

    # 1. Attach explicit module context if provided
    if req.document_context and conv_feature == "document-analysis":
        contents.append(types.Part.from_text(text=f"Active Document Context:\n{req.document_context}"))
    if req.visual_context:
        img_part, text_part, v_source = process_visual_context(req.visual_context)
        if text_part:
            contents.append(text_part)
        if img_part:
            contents.append(img_part)
    if req.media_context and conv_feature == "video-audio-review":
        contents.append(types.Part.from_text(text=f"Active Media Context:\n{req.media_context}"))

    # 2. Attach files for this specific conversation
    for f_rec in attached_files:
        part = build_file_part(f_rec)
        if part:
            contents.append(part)
        # If PDF or text, also append extracted text for maximum reliability
        txt_content = extract_file_text(f_rec, max_chars=15000)
        if txt_content:
            contents.append(types.Part.from_text(text=f"Extracted Document Text for [{f_rec.get('filename')}]:\n{txt_content}"))

    # 3. Add previous conversation history strictly for this conversation
    past_messages = conv.get("messages", [])
    recent_history = past_messages[-10:-1] if len(past_messages) > 1 else []
    for msg in recent_history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))

    # 4. Add current user prompt
    contents.append(types.Part.from_text(text=user_text))

    # Call Gemini with candidate models fallback
    full_response_text = ""
    error_details = []

    for model in GEMINI_CANDIDATE_MODELS:
        try:
            logger.info(f"Generating content for conversation {req.conversation_id} ({conv_feature}) with model: {model}")
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3
            )
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config
            )
            full_response_text = response.text or ""
            break
        except Exception as e:
            logger.warning(f"Model {model} failed: {e}")
            error_details.append(f"{model}: {str(e)}")
            await asyncio.sleep(0.5)

    if not full_response_text:
        # If attached files exist, generate grounded response from document
        if attached_files:
            full_response_text = generate_grounded_fallback_response(
                query=user_text,
                files=attached_files,
                feature=conv_feature,
                language=lang_code
            )
        elif any("API key not valid" in err or "INVALID_ARGUMENT" in err for err in error_details):
            full_response_text = (
                "⚠️ **Gemini API Key Needed**\n\n"
                "The application is running, but the configured `GEMINI_API_KEY` is invalid or still set to the default placeholder. "
                "To enable real-time Gemini AI multimodal responses and voice models, please add your Google Gemini API key to `backend/.env`:\n\n"
                "```env\nGEMINI_API_KEY=your_actual_api_key_here\n```"
            )
        else:
            err_msg = "Error contacting AI service. " + "; ".join(error_details)
            full_response_text = f"I encountered an issue processing your request: {err_msg}"

    # Save assistant response to DB
    conversation_repository.add_message(
        conv_id=req.conversation_id,
        role="assistant",
        content=full_response_text
    )

    # Customer Support Ticket Management
    active_ticket = None
    if conv_feature == "customer-support":
        try:
            from backend.repositories.ticket_repository import ticket_repository
            if req.ticket_id:
                active_ticket = ticket_repository.get_ticket(req.ticket_id)
            if not active_ticket and req.conversation_id:
                active_ticket = ticket_repository.get_ticket_by_conversation(req.conversation_id)
            if not active_ticket and req.conversation_id:
                active_ticket = ticket_repository.create_ticket(
                    subject=user_text[:50],
                    description=user_text,
                    category="Technical Support",
                    priority="Medium",
                    language=active_lang,
                    conversation_id=req.conversation_id,
                    initial_message=user_text
                )
                conversation_repository.update_conversation_ticket(req.conversation_id, active_ticket["id"])
            if active_ticket:
                ticket_repository.add_ticket_message(active_ticket["id"], "user", user_text)
                ticket_repository.add_ticket_message(active_ticket["id"], "agent", full_response_text)
                if active_ticket.get("status") == "Open":
                    ticket_repository.update_ticket_status(active_ticket["id"], "In Progress")
        except Exception as ticket_err:
            logger.warning(f"Error managing ticket for chat message: {ticket_err}")

    clean_voice = clean_for_speech_output(full_response_text) if input_mode == "voice" else None

    return {
        "response": full_response_text,
        "clean_voice_response": clean_voice,
        "conversation_id": req.conversation_id,
        "feature_id": conv_feature,
        "module": conv_feature,
        "input_mode": input_mode,
        "language": active_lang,
        "ticket_id": active_ticket.get("id") if active_ticket else None,
        "ticket": active_ticket
    }

@router.post("/stream")
async def stream_chat_message(req: ChatMessageRequest):
    """Streaming SSE endpoint with feature isolation and robust grounded fallback."""
    req_feature = normalize_feature_id(req.module or req.feature_id or req.feature)
    user_text = (req.message or req.user_prompt or "").strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Message or user_prompt is required")

    input_mode = (req.input_mode or "text").lower()

    conv = conversation_repository.get_conversation(req.conversation_id)
    if not conv:
        conv = conversation_repository.create_conversation(
            feature=req_feature,
            language=req.language or "en"
        )
        req.conversation_id = conv["id"]

    conv_feature = normalize_feature_id(conv.get("feature"))

    conversation_repository.add_message(
        conv_id=req.conversation_id,
        role="user",
        content=user_text
    )

    if conv.get("title") in ["New Conversation", "Conversation", None]:
        attached_files = conv.get("files", [])
        fn = attached_files[0]["filename"] if attached_files else None
        conversation_repository.generate_smart_title(
            conv_id=req.conversation_id,
            first_message=user_text,
            filename=fn
        )

    attached_files = conv.get("files", [])
    client = get_gemini_client()

    active_lang = resolve_interaction_language(user_text, req.language, conv.get("language"))
    lang_instruction = build_mandatory_language_instruction(active_lang)

    async def fallback_stream():
        reply = generate_grounded_fallback_response(
            query=user_text,
            files=attached_files,
            feature=conv_feature,
            language=active_lang
        )
        # Stream chunks simulating real-time delivery
        chunk_size = 25
        for i in range(0, len(reply), chunk_size):
            sub = reply[i:i+chunk_size]
            yield f"data: {json.dumps({'text': sub, 'done': False})}\n\n"
            await asyncio.sleep(0.015)

        conversation_repository.add_message(
            conv_id=req.conversation_id,
            role="assistant",
            content=reply
        )
        clean_voice = clean_for_speech_output(reply) if input_mode == "voice" else None
        yield f"data: {json.dumps({'done': True, 'full_text': reply, 'clean_voice_response': clean_voice, 'feature_id': conv_feature, 'module': conv_feature, 'input_mode': input_mode, 'language': active_lang})}\n\n"

    if not client:
        return StreamingResponse(fallback_stream(), media_type="text/event-stream")

    feature_prompt = get_feature_system_prompt(conv_feature)

    ticket_prompt = ""
    if req.ticket_id:
        try:
            ticket_prompt = ticket_repository.get_ticket_context_prompt(req.ticket_id)
        except Exception:
            pass

    voice_instruction = ""
    if input_mode == "voice":
        voice_instruction = (
            "6. VOICE RESPONSE MODE: The user dictated this prompt via voice. "
            "Formulate a direct, natural spoken response. Do NOT use markdown symbols, asterisks, hashtags, or bullet syntax "
            "so the response sounds completely natural when spoken."
        )
    else:
        voice_instruction = "6. TEXT RESPONSE MODE: Deliver clear, well-structured text for display in the workspace."

    system_instruction = (
        f"{feature_prompt}\n\n"
        f"ACTIVE MODULE: {conv_feature.upper()}\n"
        f"{lang_instruction}\n\n"
        f"{ticket_prompt}\n"
        "STRICT INSTRUCTIONS:\n"
        "1. COMPLETE MODULE ISOLATION: Answer strictly based ONLY on the attached files and conversation history belonging to this specific workspace. Do NOT reference outside materials, past sessions, or other feature domains.\n"
        "2. ABSOLUTELY NO INTERVIEW BEHAVIOR: Unless this module is explicitly 'ai-interview', you must NEVER act as an interviewer, never ask software engineering interview questions, never ask about job roles, experience, or resumes, and never conduct an interview.\n"
        "3. GROUNDING: If files are attached, analyze and answer strictly based on the actual contents of the uploaded files. Do NOT provide generic placeholder answers. Give concrete, accurate explanations.\n"
        "4. SCRIPT FIDELITY: When responding in Indian languages (Telugu, Hindi, Kannada, Marathi, Tamil, Bengali, Malayalam, Gujarati, Punjabi, Urdu), write exclusively in authentic native script.\n"
        "5. CODE PRESERVATION: Preserve programming code, syntax, and markdown formatting in original English without translating code.\n"
        f"{voice_instruction}\n"
        "7. DIRECT INTENT FULFILLMENT: Directly answer the user's specific request without adding unwanted rapid-fire viva, interview questions, or grading rubrics.\n"
        "8. VISUAL & SCREEN BOUNDARIES: If this is customer support, when an active camera image or screen share frame is attached to the request, you have genuine visual access to that frame — analyze and describe what you see (the person, held objects, screen content, error messages, devices, etc.) directly, accurately, and naturally. However, if NO camera or screen share image is attached and the user asks whether you can see their camera or screen, clarify politely: 'I cannot access your screen unless you choose to share it' or 'I cannot see your camera right now, as no camera data has been provided'."
    )

    contents: List[Any] = []

    # 1. Attach explicit module context if provided
    if req.document_context and conv_feature == "document-analysis":
        contents.append(types.Part.from_text(text=f"Active Document Context:\n{req.document_context}"))
    if req.visual_context:
        img_part, text_part, v_source = process_visual_context(req.visual_context)
        if text_part:
            contents.append(text_part)
        if img_part:
            contents.append(img_part)
    if req.media_context and conv_feature == "video-audio-review":
        contents.append(types.Part.from_text(text=f"Active Media Context:\n{req.media_context}"))

    for f_rec in attached_files:
        part = build_file_part(f_rec)
        if part:
            contents.append(part)
        txt_content = extract_file_text(f_rec, max_chars=15000)
        if txt_content:
            contents.append(types.Part.from_text(text=f"Extracted Document Text for [{f_rec.get('filename')}]:\n{txt_content}"))

    past_messages = conv.get("messages", [])
    recent_history = past_messages[-10:-1] if len(past_messages) > 1 else []
    for msg in recent_history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))

    contents.append(types.Part.from_text(text=user_text))

    async def event_generator():
        accumulated_text = []
        full_text = ""
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.3
        )

        success = False
        for model in GEMINI_CANDIDATE_MODELS:
            try:
                logger.info(f"Streaming with model {model} for feature {conv_feature}")
                for chunk in client.models.generate_content_stream(
                    model=model,
                    contents=contents,
                    config=config
                ):
                    if chunk.text:
                        accumulated_text.append(chunk.text)
                        yield f"data: {json.dumps({'text': chunk.text, 'done': False})}\n\n"
                        await asyncio.sleep(0.01)
                success = True
                full_text = "".join(accumulated_text)
                break
            except Exception as e:
                logger.warning(f"Streaming error with model {model}: {e}")
                await asyncio.sleep(0.5)

        if not success:
            if attached_files:
                # Use document fallback
                full_text = generate_grounded_fallback_response(
                    query=user_text,
                    files=attached_files,
                    feature=conv_feature,
                    language=active_lang
                )
            else:
                full_text = (
                    "⚠️ **Gemini API Key Required**\n\n"
                    "The application is running, but the configured `GEMINI_API_KEY` is invalid or still set to the default placeholder.\n\n"
                    "To enable live Gemini AI multimodal responses and voice models, please configure your API key in `backend/.env`:\n"
                    "```env\nGEMINI_API_KEY=your_actual_api_key_here\n```"
                )
            yield f"data: {json.dumps({'text': full_text, 'done': True})}\n\n"

        conversation_repository.add_message(
            conv_id=req.conversation_id,
            role="assistant",
            content=full_text
        )
        clean_voice = clean_for_speech_output(full_text) if input_mode == "voice" else None
        yield f"data: {json.dumps({'done': True, 'full_text': full_text, 'clean_voice_response': clean_voice, 'feature_id': conv_feature, 'module': conv_feature, 'input_mode': input_mode, 'language': active_lang})}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")

