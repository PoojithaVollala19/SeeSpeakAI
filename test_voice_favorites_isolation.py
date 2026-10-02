import os
import json
import asyncio
import requests
import websockets

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws/session"

def test_favorites_and_persistence():
    print("\n--- TEST 1: Favorites Database & API Persistence ---")
    # 1. Create a test conversation
    res = requests.post(f"{BASE_URL}/api/conversations", json={
        "feature": "document-analysis",
        "title": "OS Paging Analysis",
        "language": "en"
    })
    assert res.status_code == 200, f"Create conv failed: {res.text}"
    conv = res.json()
    conv_id = conv["id"]
    assert conv.get("is_favorite") is False, "New conversation should not be favorited by default"
    print(f"[PASS] Created Conv: {conv_id}, is_favorite={conv.get('is_favorite')}")

    # 2. Toggle favorite ON
    fav_res = requests.post(f"{BASE_URL}/api/conversations/{conv_id}/favorite")
    assert fav_res.status_code == 200, f"Favorite toggle failed: {fav_res.text}"
    fav_data = fav_res.json()
    assert fav_data.get("is_favorite") is True, "Favorite state should be True after toggle"
    print(f"[PASS] Toggled Favorite ON: {fav_data}")

    # 3. Verify get_conversation reflects favorite
    get_res = requests.get(f"{BASE_URL}/api/conversations/{conv_id}")
    assert get_res.status_code == 200
    assert get_res.json().get("is_favorite") is True, "Persisted conversation should have is_favorite=True"
    print(f"[PASS] GET /api/conversations/{conv_id} confirms is_favorite=True")

    # 4. Verify list_conversations includes favorite
    list_res = requests.get(f"{BASE_URL}/api/conversations?feature=document-analysis")
    assert list_res.status_code == 200
    matching = [c for c in list_res.json() if c["id"] == conv_id]
    assert len(matching) == 1 and matching[0]["is_favorite"] is True
    print(f"[PASS] list_conversations confirms is_favorite=True for {conv_id}")

    # 5. Toggle favorite OFF
    fav_res2 = requests.post(f"{BASE_URL}/api/conversations/{conv_id}/favorite")
    assert fav_res2.status_code == 200
    assert fav_res2.json().get("is_favorite") is False, "Favorite should toggle to False"
    print(f"[PASS] Toggled Favorite OFF: {fav_res2.json()}")

    # Clean up
    requests.delete(f"{BASE_URL}/api/conversations/{conv_id}")
    print("[PASS] Favorites persistence test passed 100%!")


def test_context_isolation_with_favorites():
    print("\n--- TEST 2: Context Isolation for Favorited Conversations ---")
    # 1. Create Document Analysis conversation
    res1 = requests.post(f"{BASE_URL}/api/conversations", json={
        "feature": "document-analysis",
        "title": "Belady Anomaly Analysis",
        "language": "en"
    })
    conv_a = res1.json()
    conv_a_id = conv_a["id"]

    # Upload Doc A to Conv A
    doc_content = "The Belady anomaly shows that increasing the number of page frames can cause more page faults in FIFO."
    res_upload = requests.post(
        f"{BASE_URL}/api/upload",
        files={"file": ("Belady_Report.txt", doc_content, "text/plain")},
        data={"conversation_id": conv_a_id, "feature": "document-analysis", "language": "en"}
    )
    assert res_upload.status_code == 200

    # Star Conv A
    requests.post(f"{BASE_URL}/api/conversations/{conv_a_id}/favorite")
    print(f"[PASS] Conv A ({conv_a_id}) created, file uploaded, marked FAVORITE")

    # 2. Create Visual Intelligence conversation
    res2 = requests.post(f"{BASE_URL}/api/conversations", json={
        "feature": "visual-intelligence",
        "title": "Visual Workspace Session",
        "language": "en"
    })
    conv_b = res2.json()
    conv_b_id = conv_b["id"]
    print(f"[PASS] Conv B ({conv_b_id}) created in Visual Intelligence")

    # Ask Conv B about Belady or paging
    chat_res = requests.post(f"{BASE_URL}/api/chat", json={
        "conversation_id": conv_b_id,
        "feature": "visual-intelligence",
        "message": "What document or concept was uploaded earlier?",
        "language": "en"
    })
    assert chat_res.status_code == 200
    b_answer = chat_res.json().get("content", "").lower()
    print(f"[PASS] Conv B response:\n{b_answer[:150]}...")

    # Strict isolation check: Conv B must NOT contain 'belady'
    assert "belady" not in b_answer, "CRITICAL: Conv B leaked Belady context from Conv A!"
    print("[PASS] Verified: Favorited conversation did NOT leak into Visual Intelligence!")

    # Clean up
    requests.delete(f"{BASE_URL}/api/conversations/{conv_a_id}")
    requests.delete(f"{BASE_URL}/api/conversations/{conv_b_id}")


async def test_realtime_voice_websocket():
    print("\n--- TEST 3: Real-Time Voice WebSocket & Gemini Live Pipeline ---")
    async with websockets.connect(WS_URL) as ws:
        # Handshake: session_start
        await ws.send(json.dumps({
            "type": "session_start",
            "mode": "ai-interview",
            "feature_id": "ai-interview",
            "language": "en"
        }))

        # Receive session_ready
        init_msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
        ready_evt = json.loads(init_msg)
        print(f"[PASS] Received Handshake Event: {ready_evt}")
        assert ready_evt.get("type") == "session_ready"
        assert ready_evt.get("voice_mode") in ["gemini", "mock"]

        # Send PCM16 16kHz audio stream (10 chunks of 1024 samples = ~640ms)
        dummy_pcm = b"\x00\x00" * 1024
        for _ in range(10):
            await ws.send(dummy_pcm)
            await asyncio.sleep(0.04)
        print("[PASS] Sent 10 chunks of 16kHz PCM16 audio frames to WebSocket")

        # Notify user speaking and test barge-in / interrupt
        await ws.send(json.dumps({"type": "user_speaking"}))
        await asyncio.sleep(0.1)
        await ws.send(json.dumps({"type": "interrupt"}))
        print("[PASS] Successfully sent user_speaking and interrupt signals")

    print("[PASS] WebSocket voice pipeline test completed successfully!")

if __name__ == "__main__":
    print("========================================================")
    print("  SEESPEAK AI: FAVORITES, ISOLATION & VOICE TEST SUITE  ")
    print("========================================================")
    test_favorites_and_persistence()
    test_context_isolation_with_favorites()
    asyncio.run(test_realtime_voice_websocket())
    print("\n========================================================")
    print("        ALL TEST CASES PASSED WITH 100% SUCCESS!        ")
    print("========================================================")
