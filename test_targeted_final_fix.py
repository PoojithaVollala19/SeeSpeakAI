import urllib.request
import json
import asyncio
import websockets
import re

BASE_URL = "http://127.0.0.1:8000"

def post_json(endpoint, payload):
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def test_language_switching_across_modules():
    print("==================================================")
    print("TEST 1: MULTI-MODULE LANGUAGE SWITCHING VERIFICATION")
    print("==================================================")

    # 1. Document Analysis in English
    conv1 = post_json("/api/conversations", {"feature": "document-analysis", "language": "en", "title": "Doc Test"})
    r1 = post_json("/api/chat", {
        "conversation_id": conv1["id"],
        "message": "Explain what Address Resolution Protocol is.",
        "language": "en",
        "module": "document-analysis",
        "input_mode": "text"
    })
    print(f"[Doc Analysis - EN] Lang={r1.get('language')}")
    assert r1.get("language") == "en", f"Expected en, got {r1.get('language')}"
    assert not any(ord(c) > 0x0C00 and ord(c) < 0x0C7F for c in r1["response"]), "Expected English response"
    print("  -> Passed English query")

    # 2. Switch same conversation to Telugu
    r2 = post_json("/api/chat", {
        "conversation_id": conv1["id"],
        "message": "Explain ARP spoofing attack",
        "language": "te",
        "module": "document-analysis",
        "input_mode": "text"
    })
    print(f"[Doc Analysis - Switch to TE] Lang={r2.get('language')}")
    assert r2.get("language") == "te", f"Expected te, got {r2.get('language')}"
    # Verify Telugu script presence
    has_te = any(0x0C00 <= ord(c) <= 0x0C7F for c in r2["response"])
    print(f"  -> Telugu script present: {has_te}")
    assert has_te, "Expected Telugu script in response when user selected Telugu"

    # 3. Switch same conversation to Hindi
    r3 = post_json("/api/chat", {
        "conversation_id": conv1["id"],
        "message": "Explain how to prevent ARP spoofing",
        "language": "hi",
        "module": "document-analysis",
        "input_mode": "text"
    })
    print(f"[Doc Analysis - Switch to HI] Lang={r3.get('language')}")
    assert r3.get("language") == "hi", f"Expected hi, got {r3.get('language')}"
    has_hi = any(0x0900 <= ord(c) <= 0x097F for c in r3["response"])
    print(f"  -> Hindi/Devanagari script present: {has_hi}")
    assert has_hi, "Expected Hindi script in response when user selected Hindi"

    # 4. Visual Intelligence in Telugu
    conv2 = post_json("/api/conversations", {"feature": "visual-intelligence", "language": "te", "title": "Vision Test"})
    r4 = post_json("/api/chat", {
        "conversation_id": conv2["id"],
        "message": "Explain this performance graph",
        "language": "te",
        "module": "visual-intelligence",
        "input_mode": "text"
    })
    print(f"[Visual Intelligence - TE] Lang={r4.get('language')}")
    assert r4.get("language") == "te", f"Expected te, got {r4.get('language')}"
    assert any(0x0C00 <= ord(c) <= 0x0C7F for c in r4["response"]), "Expected Telugu response"

    # 5. Data & Study Assistant in English then Telugu
    conv3 = post_json("/api/conversations", {"feature": "data-study", "language": "en", "title": "Study Test"})
    r5 = post_json("/api/chat", {
        "conversation_id": conv3["id"],
        "message": "Explain binary search trees",
        "language": "en",
        "module": "data-study",
        "input_mode": "text"
    })
    assert r5.get("language") == "en"
    print(f"[Data & Study - EN] Lang={r5.get('language')}")

    r6 = post_json("/api/chat", {
        "conversation_id": conv3["id"],
        "message": "Explain the time complexity in worst case",
        "language": "te",
        "module": "data-study",
        "input_mode": "text"
    })
    assert r6.get("language") == "te"
    assert any(0x0C00 <= ord(c) <= 0x0C7F for c in r6["response"]), "Expected Telugu in data study"
    print(f"[Data & Study - Switch to TE] Lang={r6.get('language')}")

    # 6. Customer Support in Hindi
    conv4 = post_json("/api/conversations", {"feature": "customer-support", "language": "hi", "title": "Support Test"})
    r7 = post_json("/api/chat", {
        "conversation_id": conv4["id"],
        "message": "I need help with my invoice",
        "language": "hi",
        "module": "customer-support",
        "input_mode": "text"
    })
    assert r7.get("language") == "hi"
    assert any(0x0900 <= ord(c) <= 0x097F for c in r7["response"])
    print(f"[Customer Support - HI] Lang={r7.get('language')}")

    print("ALL MODULE LANGUAGE SWITCHING TESTS PASSED!")

def test_voice_input_clean_response():
    print("\n==================================================")
    print("TEST 2: VOICE INPUT/OUTPUT MODE ISOLATION")
    print("==================================================")
    conv = post_json("/api/conversations", {"feature": "document-analysis", "language": "te", "title": "Voice Test"})
    r = post_json("/api/chat", {
        "conversation_id": conv["id"],
        "message": "Summarize section two",
        "language": "te",
        "module": "document-analysis",
        "input_mode": "voice"
    })
    assert r.get("clean_voice_response") is not None, "Expected clean_voice_response when input_mode is voice"
    assert "*" not in r["clean_voice_response"], "Markdown asterisks must be stripped from voice response"
    assert "#" not in r["clean_voice_response"], "Markdown headers must be stripped from voice response"
    # Ensure it's not an interview question
    lower_resp = r["response"].lower()
    assert "tell me about yourself" not in lower_resp
    assert "what is your experience" not in lower_resp
    print("  -> Passed Voice Input / Spoken Clean Output without interview behavior")

async def test_interview_websocket_continuous():
    print("\n==================================================")
    print("TEST 3: AI INTERVIEW WEBSOCKET CONTINUOUS VERIFICATION")
    print("==================================================")
    uri = "ws://127.0.0.1:8000/ws/session"
    async with websockets.connect(uri) as ws:
        # Start session in Telugu
        await ws.send(json.dumps({
            "type": "session_start",
            "mode": "ai-interview",
            "module": "ai-interview",
            "input_mode": "voice",
            "language": "te",
            "job_role": "Backend Engineer",
            "position": "Backend Engineer",
            "experience_level": "Senior Level",
            "interview_type": "Technical & Coding",
            "resume_context": {"candidate_name": "Test Candidate", "skills": ["Python", "PostgreSQL", "Docker"]}
        }))

        # Wait for session_ready
        ready = await ws.recv()
        ready_json = json.loads(ready)
        assert ready_json.get("type") == "session_ready"
        print(f"  -> AI Interview session_ready: mode={ready_json.get('mode')}, voice_mode={ready_json.get('voice_mode')}")

    print("ALL TARGETED FINAL TESTS PASSED 100%!")

if __name__ == "__main__":
    test_language_switching_across_modules()
    test_voice_input_clean_response()
    asyncio.run(test_interview_websocket_continuous())
