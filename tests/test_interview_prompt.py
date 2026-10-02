import pytest
import os
import sys

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.services.interview_blueprint import (
    get_minimal_fallback_blueprint,
    format_blueprint_for_prompt
)
from backend.routes.websocket_routes import load_prompt_for_mode
from backend.utils.language_detector import detect_text_language, resolve_interaction_language

def test_junior_vs_senior_calibration():
    # Junior profile
    junior_bp = get_minimal_fallback_blueprint(
        role="Data Analyst",
        level="Fresher / College Graduate",
        interview_type="Technical & Coding"
    )
    assert "JUNIOR" in junior_bp.level_calibration
    assert "hands-on fundamentals" in junior_bp.level_calibration
    assert any("fundamentals" in c for c in junior_bp.competencies_to_probe)

    # Senior profile
    senior_bp = get_minimal_fallback_blueprint(
        role="Senior Backend Engineer",
        level="Senior (5-8 years)",
        interview_type="System Design & Architecture"
    )
    assert "SENIOR" in senior_bp.level_calibration
    assert "architectural intuition" in senior_bp.level_calibration
    assert any("distributed_architecture" in c for c in senior_bp.competencies_to_probe)

def test_load_prompt_for_interview_mode_with_blueprint():
    bp = get_minimal_fallback_blueprint(
        role="Full Stack Engineer",
        level="Mid-Level (3-5 years)",
        interview_type="Technical & Coding",
        resume_profile={"skills": ["React", "Python", "FastAPI"], "projects": ["E-Commerce Platform"]}
    )
    formatted_bp = format_blueprint_for_prompt(bp)
    
    prompt = load_prompt_for_mode(
        mode="ai-interview",
        language="te",
        interview_type="Technical & Coding",
        job_role="Full Stack Engineer",
        experience_level="Mid-Level (3-5 years)",
        difficulty="Medium",
        blueprint_prompt=formatted_bp
    )
    
    # Assertions
    assert "Full Stack Engineer" in prompt
    assert "Mid-Level" in prompt
    assert "Telugu" in prompt
    assert "INTERVIEW BLUEPRINT & LEVEL CALIBRATION" in prompt
    assert "React" in prompt or "E-Commerce Platform" in prompt
    assert "MANDATORY DYNAMIC INTERVIEW SYSTEM RULES" in prompt

def test_feature_isolation_no_interview_leakage():
    # Document analysis prompt
    doc_prompt = load_prompt_for_mode(mode="document-analysis", language="en")
    assert "PURE DOCUMENT GROUNDING" in doc_prompt
    assert "ABSOLUTELY NO INTERVIEW BEHAVIOR" in doc_prompt
    assert "DYNAMIC ADAPTIVE INTERVIEW SESSION CONTEXT" not in doc_prompt

    # Customer support prompt
    support_prompt = load_prompt_for_mode(mode="customer-support", language="en")
    assert "STRICT CUSTOMER SUPPORT OPERATIONAL RULES" in support_prompt
    assert "DYNAMIC ADAPTIVE INTERVIEW SESSION CONTEXT" not in support_prompt

def test_language_priority_routing():
    # Hindi prompt
    hindi_text = "इस दस्तावेज़ के बारे में समझाओ"
    assert detect_text_language(hindi_text) == "hi"
    assert resolve_interaction_language(hindi_text, explicit_lang="en", session_lang="en") == "hi"

    # Telugu prompt
    telugu_text = "ఈ డాక్యుమెంట్లో ముఖ్యమైన విషయాలు ఏమిటి?"
    assert detect_text_language(telugu_text) == "te"
    assert resolve_interaction_language(telugu_text, explicit_lang="en", session_lang="en") == "te"

    # English prompt (Latin script)
    english_text = "Explain the second section"
    assert detect_text_language(english_text) == "en"
    assert resolve_interaction_language(english_text, explicit_lang="en", session_lang="hi") == "en"
    assert resolve_interaction_language(english_text, explicit_lang="hi", session_lang="en") == "hi"
    assert resolve_interaction_language(english_text, explicit_lang="te", session_lang="en") == "te"

    # Blank fallback to explicit or session
    assert resolve_interaction_language("", explicit_lang="te", session_lang="en") == "te"
    assert resolve_interaction_language("", explicit_lang=None, session_lang="hi") == "hi"
