import asyncio
import json
import urllib.request
import urllib.error
import websockets

BASE_URL = "http://127.0.0.1:8000"

def test_document_analysis_text_and_voice():
    print("\n=======================================================")
    print("TEST A: DOCUMENT ANALYSIS (TEXT vs VOICE & STRICT ISOLATION)")
    print("=======================================================")
    
    # 1. Create Document Analysis Conversation
    conv_data = json.dumps({
        "feature": "document-analysis",
        "language": "en",
        "title": "Computer Networks Revision"
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/api/conversations", data=conv_data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        conv = json.loads(r.read().decode())
    conv_id = conv["id"]
    print(f"[PASS] Created Document Analysis conversation: {conv_id}")

    # 2. Upload Networking Document
    boundary = "----WebKitFormBoundaryNetDoc123"
    doc_content = (
        "Computer Networks: Address Resolution Protocol (ARP) maps an IP address to a physical MAC address on a local area network. "
        "ARP spoofing is an attack where an adversary sends falsified ARP messages over a local area network to link their MAC address with the IP address of a legitimate computer or gateway."
    )
    body = (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"file\"; filename=\"Computer_Networks.txt\"\r\n"
        f"Content-Type: text/plain\r\n\r\n"
        f"{doc_content}\r\n"
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"conversation_id\"\r\n\r\n"
        f"{conv_id}\r\n"
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"feature\"\r\n\r\n"
        f"document-analysis\r\n"
        f"--{boundary}--\r\n"
    ).encode("utf-8")
    upload_req = urllib.request.Request(f"{BASE_URL}/api/upload", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(upload_req) as r:
        upload_res = json.loads(r.read().decode())
    print(f"[PASS] Uploaded document: {upload_res['filename']}")

    # 3. TEXT PROMPT: "Explain ARP according to this document."
    # Expected: TEXT answer about ARP from document. NO interview questions, NO role/candidate inquiries!
    chat_text_payload = json.dumps({
        "conversation_id": conv_id,
        "message": "Explain ARP according to this document.",
        "language": "en",
        "feature": "document-analysis",
        "module": "document-analysis",
        "input_mode": "text"
    }).encode("utf-8")
    chat_req = urllib.request.Request(f"{BASE_URL}/api/chat", data=chat_text_payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(chat_req) as r:
        ans_text = json.loads(r.read().decode())
    
    response_text = ans_text["response"]
    print(f"[PASS] Text Prompt Answer preview:\n  {response_text[:180]}...")
    
    # Assertions
    assert "arp" in response_text.lower() or "address resolution" in response_text.lower(), "Response must explain ARP"
    assert ans_text.get("input_mode") == "text", "input_mode must be 'text'"
    
    # Verify strict non-interview negative checks
    forbidden_terms = ["candidate", "interview", "software engineer", "your experience with", "let's begin your interview", "viva question 1"]
    for term in forbidden_terms:
        assert term not in response_text.lower(), f"Forbidden interview term '{term}' leaked into Document Analysis!"
    print("[PASS] Verified: Zero interview behavior or persona in Document Analysis text response!")

    # 4. VOICE PROMPT: "What does this document say about ARP spoofing?"
    # Expected: Answer explains ARP spoofing and includes clean_voice_response. NO interview questions!
    chat_voice_payload = json.dumps({
        "conversation_id": conv_id,
        "message": "What does this document say about ARP spoofing?",
        "language": "en",
        "feature": "document-analysis",
        "module": "document-analysis",
        "input_mode": "voice"
    }).encode("utf-8")
    chat_voice_req = urllib.request.Request(f"{BASE_URL}/api/chat", data=chat_voice_payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(chat_voice_req) as r:
        ans_voice = json.loads(r.read().decode())
    
    voice_resp = ans_voice["response"]
    clean_voice = ans_voice.get("clean_voice_response", "")
    print(f"[PASS] Voice Prompt Answer preview:\n  {voice_resp[:180]}...")
    print(f"[PASS] Clean Voice Speech preview:\n  {clean_voice[:180]}...")
    
    assert "spoofing" in voice_resp.lower() or "mac address" in voice_resp.lower(), "Voice prompt must explain ARP spoofing"
    assert ans_voice.get("input_mode") == "voice", "input_mode must be 'voice'"
    assert clean_voice != "", "clean_voice_response must be provided for voice inputMode"
    assert not any(symbol in clean_voice for symbol in ["**", "###", "```", "---"]), "clean_voice_response must have raw markdown stripped"
    for term in forbidden_terms:
        assert term not in voice_resp.lower(), f"Forbidden interview term '{term}' leaked into voice response!"
    print("[PASS] Verified: Document Analysis Voice prompt cleanly answers document question with clean voice output!")


def test_visualization_and_media_isolation():
    print("\n=======================================================")
    print("TEST B & C: VISUALIZATION & MEDIA REVIEW ISOLATION")
    print("=======================================================")
    
    # 1. Visualization Module
    vis_payload = json.dumps({
        "message": "Explain this bar chart showing quarterly revenue: Q1 $10M, Q2 $15M, Q3 $12M, Q4 $22M.",
        "language": "en",
        "feature": "visual-intelligence",
        "module": "visual-intelligence",
        "input_mode": "text"
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/api/chat", data=vis_payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        vis_res = json.loads(r.read().decode())
    vis_text = vis_res["response"]
    print(f"[PASS] Visualization Answer preview:\n  {vis_text[:160]}...")
    assert any(w in vis_text.lower() for w in ["revenue", "quarter", "q4", "growth", "chart"]), "Must address visual/data prompt"
    assert "interview" not in vis_text.lower() and "candidate" not in vis_text.lower()

    # 2. Audio/Video Review Module
    media_payload = json.dumps({
        "message": "Summarize the key presentation points from the video recording regarding TCP three-way handshake.",
        "language": "en",
        "feature": "video-audio-review",
        "module": "video-audio-review",
        "input_mode": "text"
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/api/chat", data=media_payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        media_res = json.loads(r.read().decode())
    media_text = media_res["response"]
    print(f"[PASS] Media Review Answer preview:\n  {media_text[:160]}...")
    assert any(w in media_text.lower() for w in ["tcp", "handshake", "syn", "ack", "connection", "presentation"]), "Must address media prompt"
    assert "software engineer interview" not in media_text.lower() and "candidate experience" not in media_text.lower()
    print("[PASS] Verified: Visualization & Media Review modules are 100% isolated!")


def test_ai_interview_multi_turn_dynamic():
    print("\n=======================================================")
    print("TEST D, E, F: AI INTERVIEW CONTINUITY, RESUME GROUNDING, MULTI-TURN & NO QUESTION LIMIT")
    print("=======================================================")

    from backend.providers.realtime.mock_realtime import MockRealtimeProvider
    
    # 1. Provide Candidate Resume & Config
    resume_context = {
        "candidate_name": "Karthik Verma",
        "skills": ["Python", "FastAPI", "React", "Docker", "Kubernetes", "PostgreSQL"],
        "projects": [
            {
                "title": "Autonomous Drone Fleet Telemetry",
                "description": "Engineered real-time telemetry streaming service with FastAPI, Redis, and WebSockets processing 50k msgs/sec."
            }
        ],
        "experience": "3 years as a Backend Engineer"
    }

    provider = MockRealtimeProvider(
        mode="ai-interview",
        job_role="Senior Backend Engineer",
        experience_level="Mid-Level (3-5 years)",
        interview_type="Technical & Coding",
        difficulty="Hard",
        language="en",
        resume_context=resume_context
    )

    # 2. Simulate 8 continuous turns
    print("[TEST] Running 8-turn dynamic interview simulation...")
    turns = [
        "Hi, I am Karthik. I have 3 years of experience as a Backend Engineer building distributed real-time APIs with FastAPI and Docker.",
        "In the Autonomous Drone Fleet Telemetry project, I used WebSockets and Redis Pub/Sub to fan out telemetry data to connected dashboards.",
        "We handled backpressure by implementing token bucket rate-limiting and buffer dropping strategies for non-critical sensor streams.",
        "For database persistence, we chose PostgreSQL with TimescaleDB extension for time-series geospatial querying.",
        "We achieved zero-downtime deployments using rolling updates in Kubernetes with readiness and liveness probes.",
        "When handling schema migrations across distributed instances, we used Alembic with backward-compatible additive column updates.",
        "For disaster recovery, we had automated daily WAL archiving to S3 with multi-region read replicas.",
        "That covers the core architecture. What other system components would you like to explore?"
    ]

    for turn_num, candidate_answer in enumerate(turns, 1):
        question = asyncio.run(provider._generate_next_question(user_answer=candidate_answer))
        print(f"Turn {turn_num} Next Question: {question}")
        assert question and len(question) > 20, f"Turn {turn_num} produced invalid question"
        # Verify internal thoughts NEVER appear in user-facing question
        forbidden_internal = [
            "refining the initial question", "initiating interview protocol",
            "analyzing candidate", "preparing next question", "interview protocol"
        ]
        for f in forbidden_internal:
            assert f not in question.lower(), f"Internal thought '{f}' leaked into generated interview question!"
    
    print(f"[PASS] Successfully completed {len(turns)} turns dynamically without getting stuck or hitting any fixed limit!")

    # 3. Test Module Switching (AI Interview -> Document Analysis)
    print("\n--- TEST F: Module Switching Verification ---")
    doc_payload = json.dumps({
        "message": "Explain ARP cache poisoning in 1 sentence.",
        "language": "en",
        "feature": "document-analysis",
        "module": "document-analysis",
        "input_mode": "text"
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/api/chat", data=doc_payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        switch_res = json.loads(r.read().decode())
    sw_text = switch_res["response"]
    print(f"[PASS] Document Analysis response after interview:\n  {sw_text[:160]}...")
    assert "arp" in sw_text.lower(), "Must answer ARP question"
    assert "karthik" not in sw_text.lower() and "drone" not in sw_text.lower() and "interview" not in sw_text.lower()
    print("[PASS] Verified: Zero interview context or resume leakage into Document Analysis!")


if __name__ == "__main__":
    test_document_analysis_text_and_voice()
    test_visualization_and_media_isolation()
    test_ai_interview_multi_turn_dynamic()
    print("\n" + "=" * 65)
    print("  ALL TESTS PASSED: MODULE ISOLATION & VOICE/TEXT ROUTING VERIFIED! ")
    print("=" * 65)
