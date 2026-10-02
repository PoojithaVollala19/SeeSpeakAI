import asyncio
import json
import io
import os
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')
from backend.services.resume_parser import resume_parser, format_resume_context_for_prompt
from backend.services.interview_evaluator import evaluate_interview_session
from backend.routes.websocket_routes import load_prompt_for_mode
from backend.providers.realtime.mock_realtime import MockRealtimeProvider
import urllib.request

def create_sample_docx(text: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        doc_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
                <w:p><w:r><w:t>{text}</w:t></w:r></w:p>
            </w:body>
        </w:document>"""
        zf.writestr("word/document.xml", doc_xml)
        zf.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>')
    return buf.getvalue()

async def run_tests():
    print("=== STARTING DYNAMIC RESUME & MULTILINGUAL INTERVIEW TESTS ===")

    # Test 1 & 2: Resume parsing (TXT and DOCX)
    print("\n--- TEST 1: Parsing TXT Resume ---")
    txt_resume = """
    Pooja Sharma
    Email: pooja.sharma@example.com
    Experience: 3+ years in Full Stack Development
    Skills: React, TypeScript, Node.js, PostgreSQL, Docker, AWS, GraphQL
    Projects:
    1. E-Commerce Microservices: Architected an online marketplace with Node.js and React, handling 50k DAU. Used JWT and Redis for session cache.
    2. Cloud Monitoring Dashboard: Built real-time analytics with React, TailwindCSS, and PostgreSQL.
    Education: B.Tech in Computer Science
    """
    parsed_txt = resume_parser.parse_text(txt_resume, "pooja_resume.txt")
    print(f"Extracted skills count: {len(parsed_txt['skills'])} -> {parsed_txt['skills']}")
    print(f"Extracted projects count: {len(parsed_txt['projects'])}")
    assert "react" in [s.lower() for s in parsed_txt["skills"]], "React skill should be found"
    assert "docker" in [s.lower() for s in parsed_txt["skills"]], "Docker skill should be found"
    assert len(parsed_txt["projects"]) >= 1, "Projects should be detected"
    print("TXT Resume parsing PASSED.")

    print("\n--- TEST 2: Parsing DOCX Resume ---")
    docx_bytes = create_sample_docx("Jane Doe. Senior Python Engineer with 5 years experience in Django, FastAPI, Redis, Kubernetes. Project: High-frequency Trading API.")
    parsed_docx = resume_parser.parse_docx_bytes(docx_bytes, "jane_resume.docx")
    print(f"Extracted DOCX skills: {parsed_docx['skills']}")
    assert "python" in [s.lower() for s in parsed_docx["skills"]] or "fastapi" in [s.lower() for s in parsed_docx["skills"]]
    print("DOCX Resume parsing PASSED.")

    # Test 3: Resume prompt formatting
    print("\n--- TEST 3: Resume Prompt Context Formatting ---")
    context_str = format_resume_context_for_prompt(parsed_txt)
    print(context_str[:200] + "...")
    assert "IDENTIFIED SKILLS & TECHNOLOGIES" in context_str
    assert "React" in context_str
    print("Prompt context formatting PASSED.")

    # Test 4: Multilingual System Prompt Generation with Language Lock
    print("\n--- TEST 4: Dynamic System Prompt with Telugu Language Lock ---")
    prompt_te = load_prompt_for_mode(
        mode="ai-interview",
        language="te",
        job_role="Frontend Engineer",
        interview_type="Technical & Coding",
        experience_level="Mid-Level (3-5 years)",
        resume_context=parsed_txt
    )
    assert "Telugu" in prompt_te, "Telugu should be explicitly declared in prompt"
    assert "Candidate Resume" in prompt_te or "Candidate resume" in prompt_te
    assert "ONE QUESTION AT A TIME" in prompt_te
    print("Telugu system prompt generation PASSED.")

    print("\n--- TEST 5: Dynamic System Prompt with Hindi Language Lock ---")
    prompt_hi = load_prompt_for_mode(
        mode="ai-interview",
        language="hi",
        job_role="Backend Developer",
        interview_type="Technical & Coding",
        experience_level="Junior (1-2 years)",
        resume_context=parsed_txt
    )
    assert "Hindi" in prompt_hi, "Hindi should be declared in prompt"
    print("Hindi system prompt generation PASSED.")

    # Test 6: Mock Dynamic Interview Question Progression (Adaptive + Resume-Specific)
    print("\n--- TEST 6: Mock Realtime Dynamic Question Progression ---")
    mock_provider = MockRealtimeProvider(sample_rate=24000)
    mock_provider.configure(
        job_role="Frontend Developer",
        interview_type="Technical & Coding",
        experience_level="3-5 years",
        language="en",
        resume_context=parsed_txt
    )
    # Check kickoff
    q1 = await mock_provider._generate_next_question("")
    mock_provider.questions_asked.append(q1)
    print(f"Kickoff Q1: {q1}")
    assert len(q1) > 10

    # Simulate Candidate Answer 1
    resp1 = await mock_provider._generate_next_question("I primarily use React with Redux Toolkit for state management, and optimized our re-renders with useMemo.")
    mock_provider.questions_asked.append(resp1)
    print(f"Follow-up Q2: {resp1}")
    assert len(resp1) > 10
    assert len(mock_provider.questions_asked) >= 2

    # Simulate Candidate Answer 2 mentioning resume project
    resp2 = await mock_provider._generate_next_question("On the E-Commerce project, we implemented JWT with short-lived access tokens and refresh tokens in HTTP-only cookies.")
    mock_provider.questions_asked.append(resp2)
    print(f"Follow-up Q3: {resp2}")
    assert len(resp2) > 10
    print("Adaptive interview progression PASSED.")

    # Test 7: Multilingual Evaluation Output
    print("\n--- TEST 7: Multilingual Evaluation in Telugu ---")
    eval_result_te = evaluate_interview_session(
        interview_type="Technical & Coding",
        language="te",
        transcript=[
            {"speaker": "ai", "text": "నమస్కారం, మీ React ప్రాజెక్ట్‌ల గురించి వివరించగలరా?"},
            {"speaker": "user", "text": "నేను React మరియు Redux ఉపయోగించి e-commerce అప్లికేషన్ డెవలప్ చేశాను. స్టేట్ మేనేజ్‌మెంట్ బాగా హ్యాండిల్ చేశాను."},
            {"speaker": "ai", "text": "చాలా బాగుంది! Redux లో async actions కోసం ఏమి ఉపయోగించారు?"},
            {"speaker": "user", "text": "Redux Toolkit createAsyncThunk ఉపయోగించాను."}
        ],
        experience_metrics={
            "job_role": "Frontend Developer",
            "experience_level": "Mid-Level (3-5 years)",
            "resume_context": parsed_txt
        }
    )
    print(f"Overall Score: {eval_result_te['overall_score']}/100")
    print(f"Summary preview: {eval_result_te['summary'][:150]}...")
    print(f"Strengths: {eval_result_te['strengths']}")
    assert eval_result_te["overall_score"] > 0
    assert len(eval_result_te["strengths"]) > 0
    print("Multilingual Telugu evaluation PASSED.")

    # Test 8: Live API HTTP Endpoints (Upload Resume & Session Creation)
    print("\n--- TEST 8: Live Backend HTTP Endpoints ---")
    
    # 8a: Upload Resume endpoint via multipart form-data
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="candidate_resume.txt"\r\n'
        f"Content-Type: text/plain\r\n\r\n"
        f"{txt_resume}\r\n"
        f"--{boundary}--\r\n"
    ).encode('utf-8')
    
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/interviews/upload-resume",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        res_data = json.loads(resp.read().decode('utf-8'))
        print("Upload Resume API response:", res_data["filename"], "Skills detected:", len(res_data["parsed"]["skills"]))
        assert res_data["filename"] == "candidate_resume.txt"
        assert len(res_data["parsed"]["skills"]) > 0

    # 8b: Create Interview Session without num_questions
    session_payload = {
        "job_role": "Full Stack Developer",
        "interview_type": "Technical & Coding",
        "experience_level": "3-5 years",
        "language": "te",
        "resume_context": res_data["parsed"]
    }
    req2 = urllib.request.Request(
        "http://127.0.0.1:8000/api/interviews/sessions",
        data=json.dumps(session_payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req2) as resp2:
        assert resp2.status == 200
        res_session = json.loads(resp2.read().decode('utf-8'))
        print("Create Session API response:", res_session["id"], res_session["job_role"], res_session["language"])
        assert "num_questions" not in res_session
        assert res_session["language"] == "te"

    print("\n=== ALL DYNAMIC RESUME & MULTILINGUAL TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
