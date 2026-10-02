import asyncio
import json
import websockets
import sys

async def test_interview_state_machine():
    uri = "ws://127.0.0.1:8000/ws/session"
    print(f"\n[TEST] Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        # Step 1: Start interview session
        start_payload = {
            "type": "session_start",
            "mode": "ai-interview",
            "feature_id": "ai-interview",
            "job_role": "Software Engineer",
            "experience_level": "Fresher / College Graduate",
            "interview_type": "Technical & Coding",
            "difficulty": "Easy",
            "num_questions": 3,
            "language": "en"
        }
        await ws.send(json.dumps(start_payload))
        print("[TEST] Sent session_start payload")

        session_ready_received = False
        first_ai_turns = []
        turn_completed = False
        user_turn_confirmed = False
        second_ai_turn = None

        # Collect AI Turn 1
        while not turn_completed:
            msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
            if isinstance(msg, str):
                data = json.loads(msg)
                evt_type = data.get("type")
                if evt_type == "session_ready":
                    session_ready_received = True
                    print(f"[TEST] Received session_ready: mode={data.get('voice_mode')}")
                elif evt_type == "transcript" and data.get("role") == "agent":
                    if data.get("is_final"):
                        first_ai_turns.append(data.get("text"))
                        print(f"[TEST] Received finalized AI turn 1: '{data.get('text')}'")
                elif evt_type == "turn_complete":
                    turn_completed = True
                    print("[TEST] Received turn_complete for AI Turn 1")

        assert session_ready_received, "Expected session_ready event"
        assert len(first_ai_turns) == 1, f"Expected exactly 1 finalized AI turn bubble, got {len(first_ai_turns)}: {first_ai_turns}"
        print(f"[TEST] PASS: Exactly 1 complete AI question received: \"{first_ai_turns[0][:60]}...\"")

        # Step 2: Candidate responds with a multi-sentence answer
        candidate_answer = "I completed my degree in computer science and built full-stack web applications using React and FastAPI. In my final year project, I focused on high-performance real-time data streaming."
        print(f"\n[TEST] Sending candidate answer: \"{candidate_answer}\"")
        await ws.send(json.dumps({
            "type": "user_text",
            "text": candidate_answer
        }))

        # Step 3: Verify candidate turn is confirmed as ONE bubble, then AI responds with Question 2
        ai_turn_2_done = False
        while not ai_turn_2_done:
            msg = await asyncio.wait_for(ws.recv(), timeout=15.0)
            if isinstance(msg, str):
                data = json.loads(msg)
                evt_type = data.get("type")
                if evt_type == "transcript" and data.get("role") == "user" and data.get("is_final"):
                    user_turn_confirmed = True
                    print(f"[TEST] Confirmed user finalized turn: '{data.get('text')}'")
                elif evt_type == "transcript" and data.get("role") == "agent" and data.get("is_final"):
                    second_ai_turn = data.get("text")
                    print(f"[TEST] Received finalized AI turn 2 (Question 2): '{second_ai_turn}'")
                elif evt_type == "turn_complete" and second_ai_turn:
                    ai_turn_2_done = True
                    print("[TEST] Received turn_complete for AI Turn 2")

        assert user_turn_confirmed, "Candidate answer should be confirmed as finalized turn"
        assert second_ai_turn, "AI should ask follow-up question / Question 2"
        print("[TEST] PASS: Turn-taking state machine executed successfully with zero fragmentation!")

if __name__ == "__main__":
    asyncio.run(test_interview_state_machine())
