import re
from typing import Optional

def detect_text_language(text: str) -> Optional[str]:
    """
    Detects the interaction language from the user's input text based on Unicode scripts
    and characteristic vocabulary. Returns standard 2-letter code or None.
    """
    if not text or not text.strip():
        return None

    # Count script characters to determine primary script
    counts = {
        "te": 0,  # Telugu
        "hi": 0,  # Hindi / Devanagari
        "ta": 0,  # Tamil
        "kn": 0,  # Kannada
        "ml": 0,  # Malayalam
        "bn": 0,  # Bengali
        "gu": 0,  # Gujarati
        "pa": 0,  # Punjabi / Gurmukhi
        "ur": 0,  # Urdu / Arabic
        "ja": 0,  # Japanese
        "ko": 0,  # Korean
        "zh": 0,  # Chinese
        "latin": 0
    }

    for ch in text:
        code = ord(ch)
        if 0x0C00 <= code <= 0x0C7F:
            counts["te"] += 1
        elif 0x0900 <= code <= 0x097F:
            counts["hi"] += 1
        elif 0x0B80 <= code <= 0x0BFF:
            counts["ta"] += 1
        elif 0x0C80 <= code <= 0x0CFF:
            counts["kn"] += 1
        elif 0x0D00 <= code <= 0x0D7F:
            counts["ml"] += 1
        elif 0x0980 <= code <= 0x09FF:
            counts["bn"] += 1
        elif 0x0A80 <= code <= 0x0AFF:
            counts["gu"] += 1
        elif 0x0A00 <= code <= 0x0A7F:
            counts["pa"] += 1
        elif 0x0600 <= code <= 0x06FF:
            counts["ur"] += 1
        elif 0x3040 <= code <= 0x30FF:
            counts["ja"] += 1
        elif (0xAC00 <= code <= 0xD7AF) or (0x1100 <= code <= 0x11FF):
            counts["ko"] += 1
        elif 0x4E00 <= code <= 0x9FFF:
            counts["zh"] += 1
        elif (0x0041 <= code <= 0x005A) or (0x0061 <= code <= 0x007A):
            counts["latin"] += 1

    # Find highest non-Latin script count
    non_latin = {k: v for k, v in counts.items() if k != "latin"}
    best_script, best_count = max(non_latin.items(), key=lambda item: item[1])

    if best_count >= 2 or (best_count > 0 and counts["latin"] == 0):
        # Distinguish Marathi from Hindi in Devanagari script if characteristic words exist
        if best_script == "hi":
            marathi_indicators = ["आहे", "नाही", "करा", "काय", "झाले", "कसे", "मला", "आपण", "होते", "आणि"]
            if any(w in text for w in marathi_indicators):
                return "mr"
            return "hi"
        if best_script == "zh" and counts["ja"] > 0:
            return "ja"
        return best_script

    # Latin text checks
    if counts["latin"] > 0:
        lower = f" {text.lower()} "
        if any(w in lower for w in [" bonjour ", " s'il vous plaît ", " merci ", " français ", " pourquoi ", " comment ", " dans ce document ", " explique ", " paragraphe "]):
            return "fr"
        if any(w in lower for w in [" hola ", " por favor ", " gracias ", " español ", " explica ", " resumen ", " documento ", " qué es ", " seccion "]):
            return "es"
        if any(w in lower for w in [" hallo ", " bitte ", " danke ", " deutsch ", " erklären ", " zusammenfassung "]):
            return "de"
        return "en"

    return None

def resolve_interaction_language(
    user_text: str,
    explicit_lang: Optional[str] = None,
    session_lang: Optional[str] = None
) -> str:
    """
    Enforces Strict Language Priority (Current User Selection as Single Source of Truth):
    1. If user typed explicitly in a non-Latin native script (Telugu, Devanagari/Hindi, Kannada, Tamil, etc.),
       respect that script as the current interaction language.
    2. The explicit language selected by the user for the current interaction (Authoritative Single Source of Truth).
    3. Existing session language only when current language cannot be reliably determined.
    """
    detected = detect_text_language(user_text)

    # 1. If user explicitly typed in a non-Latin native script (Telugu, Hindi, Kannada, etc.),
    # the typed native script takes priority:
    if detected and detected in ["te", "hi", "kn", "mr", "ta", "ml", "bn", "gu", "pa", "ur", "ja", "ko", "zh"]:
        return detected

    # 2. Authoritative current user selection sent with request:
    if explicit_lang and explicit_lang.strip():
        return explicit_lang.strip().lower()

    # 3. Detected vocabulary for European languages or English:
    if detected and detected in ["fr", "es", "de", "en"]:
        return detected

    # 4. Existing session language:
    if session_lang and session_lang.strip():
        return session_lang.strip().lower()

    return "en"
