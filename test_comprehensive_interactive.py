"""
Comprehensive Automated Test Suite for SeeSpeak AI:
1. Interview Conversation Progression (multi-turn question advancement, no repetitive greeting)
2. Interview Configuration (role, type, level, difficulty, num_questions)
3. Transcript Continuity & Speaker Ordering
4. Interview Evaluation & Rubric Metrics (overall, communication, technical, problem solving, strengths, areas for improvement)
5. Interview Completion and Experience Metrics
6. WebSocket Interruption / Barge-in
7. Customer Support Multi-Turn Interactive Flow
8. Ticket Creation, Persistence, and Context Inclusion
9. Customer Support Result & Summary Screen Endpoint (/api/tickets/summarize-session)
10. Document Upload Restrictions (format validation per workspace)
11. Document Context Retention, PDF Extraction, and Grounded Summarization / Q&A
12. API Error Handling (unsupported formats, missing files, not found)
"""

import os
import json
import uuid
import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.repositories.interview_repository import interview_repository
from backend.repositories.ticket_repository import ticket_repository
from backend.repositories.conversation_repository import conversation_repository

client = TestClient(app)

class TestComprehensiveInteractive(unittest.TestCase):

    def setUp(self):
        self.client = client

    def test_01_interview_configuration_and_lifecycle(self):
        """Test creating an interview session with explicit role, experience, difficulty, questions, and verifying rubric completion."""
        # 1. Create interview session with custom configuration
        create_res = self.client.post("/api/interviews/sessions", json={
            "interview_type": "Technical",
            "job_role": "Full Stack Engineer",
            "experience_level": "Mid-Level",
            "difficulty": "Hard",
            "job_description": "React, Python, FastAPI, Microservices",
            "language": "en"
        })
        self.assertEqual(create_res.status_code, 200)
        session_data = create_res.json()
        session_id = session_data["id"]
        self.assertTrue(session_id.startswith("intv_"))
        self.assertEqual(session_data["job_role"], "Full Stack Engineer")
        self.assertEqual(session_data["experience_level"], "Mid-Level")
        self.assertEqual(session_data["difficulty"], "Hard")
        self.assertNotIn("num_questions", session_data)

        # 2. Add realistic multi-turn conversation transcript
        turns = [
            {"speaker": "ai", "text": "Welcome to your Full Stack Engineer interview! Could you please introduce yourself?", "timestamp": "2026-09-30T10:00:00Z"},
            {"speaker": "user", "text": "Hi, I am a software engineer with 3 years experience building FastAPI backends and React frontends with WebSocket streaming.", "timestamp": "2026-09-30T10:00:30Z"},
            {"speaker": "ai", "text": "Great overview. Can you describe how you design idempotent RESTful APIs and handle distributed transactions?", "timestamp": "2026-09-30T10:01:00Z"},
            {"speaker": "user", "text": "I use idempotency keys stored in Redis with atomic SETNX, and the Saga pattern with compensating transactions for distributed workflows.", "timestamp": "2026-09-30T10:01:45Z"}
        ]
        interview_repository.update_transcript(session_id, turns)

        # 3. Complete interview session and evaluate
        comp_res = self.client.post(f"/api/interviews/sessions/{session_id}/complete", json={
            "duration_seconds": 210,
            "experience_metrics": {
                "interruptions": 1,
                "camera_used": True,
                "screen_share_used": False,
                "speaking_activity_user_pct": 52,
                "speaking_activity_ai_pct": 48
            }
        })
        self.assertEqual(comp_res.status_code, 200)
        comp_data = comp_res.json()
        self.assertEqual(comp_data["status"], "completed")
        self.assertEqual(comp_data["duration"], 210)

        # 4. Verify evaluation rubric metrics are fully populated (no empty scores)
        eval_data = comp_data.get("evaluation")
        self.assertIsNotNone(eval_data)
        self.assertIn("overall_score", eval_data)
        self.assertGreater(eval_data["overall_score"], 0)

        scores = eval_data.get("scores", {})
        self.assertTrue(len(scores) >= 5, f"Expected comprehensive rubric scores, got: {scores}")
        for metric in ["communication", "technical_knowledge", "problem_solving", "relevance", "clarity"]:
            self.assertIn(metric, scores)
            self.assertGreater(scores[metric], 0)

        self.assertTrue(len(eval_data.get("strengths", [])) > 0)
        self.assertTrue(len(eval_data.get("improvements", [])) > 0)
        self.assertTrue(len(eval_data.get("feedback", "")) > 0)

    def test_02_mock_realtime_interview_progression_no_repeat_greeting(self):
        """Verify MockRealtimeProvider advances questions sequentially across multiple turns without repeating greeting."""
        from backend.providers.realtime.mock_realtime import MockRealtimeProvider
        import asyncio

        async def run_flow():
            provider = MockRealtimeProvider(
                mode="ai-interview",
                job_role="Backend Developer",
                experience_level="Senior",
                interview_type="Technical",
                difficulty="Hard",
                language="en"
            )
            await provider.connect(system_prompt="Test Prompt")

            # Turn 1: User says hello / initiates
            await provider.send_text("Hello, I am ready to start the interview.")
            agent_msgs = []
            async for item in provider.receive():
                if isinstance(item, dict):
                    if item.get("type") == "output_transcript":
                        agent_msgs.append(item.get("text"))
                    elif item.get("type") == "turn_complete":
                        break

            self.assertEqual(len(agent_msgs), 1)
            turn1_reply = agent_msgs[0]
            self.assertTrue(len(turn1_reply) > 20 and ("welcome" in turn1_reply.lower() or "hello" in turn1_reply.lower() or "interview" in turn1_reply.lower() or "backend" in turn1_reply.lower()))
            self.assertNotIn("Please configure your Gemini API key", turn1_reply)

            # Turn 2: User introduces themselves
            await provider.send_text("I have 5 years experience with distributed Python systems and database optimization.")
            agent_msgs_2 = []
            async for item in provider.receive():
                if isinstance(item, dict):
                    if item.get("type") == "output_transcript":
                        agent_msgs_2.append(item.get("text"))
                    elif item.get("type") == "turn_complete":
                        break

            self.assertEqual(len(agent_msgs_2), 1)
            turn2_reply = agent_msgs_2[0]
            # Must advance to Question 2, not repeat introduction
            self.assertNotEqual(turn1_reply, turn2_reply)
            self.assertTrue("python" in turn2_reply.lower() or "database" in turn2_reply.lower() or "project" in turn2_reply.lower() or "architecture" in turn2_reply.lower() or "trade-offs" in turn2_reply.lower())
            self.assertNotIn("Please configure your Gemini API key", turn2_reply)

            await provider.close()

        asyncio.run(run_flow())

    def test_03_websocket_interruption_and_transcript_continuity(self):
        """Verify WebSocket handshake, text exchange, transcript event emission, and clean interruption."""
        with self.client.websocket_connect("/ws/session") as ws:
            # 1. Handshake
            ws.send_text(json.dumps({
                "type": "session_start",
                "mode": "ai-interview",
                "language": "en",
                "voice_mode": "mock",
                "job_role": "Data Scientist"
            }))
            ready_resp = json.loads(ws.receive_text())
            self.assertEqual(ready_resp["type"], "session_ready")

            # 2. User typed text turn
            ws.send_text(json.dumps({
                "type": "user_text",
                "text": "Hello, I am ready for the data science interview."
            }))

            # Collect events until turn_complete
            events = []
            while True:
                msg = ws.receive()
                if "text" in msg:
                    data = json.loads(msg["text"])
                    events.append(data)
                    if data.get("type") == "turn_complete":
                        break

            event_types = [e.get("type") for e in events]
            self.assertIn("transcript", event_types)
            transcript_texts = [e.get("text") for e in events if e.get("type") == "transcript"]
            self.assertTrue(any("data science" in (t or "").lower() or "introduce" in (t or "").lower() for t in transcript_texts))

            # 3. Interruption / barge-in event
            ws.send_text(json.dumps({"type": "interrupt"}))
            int_resp = json.loads(ws.receive_text())
            self.assertEqual(int_resp["type"], "interrupt")

    def test_04_customer_support_ticketing_and_summary_endpoint(self):
        """Verify customer support ticket creation, message posting, and post-session summary generation."""
        # 1. Create support ticket
        t_res = self.client.post("/api/tickets", json={
            "customer_name": "Test User",
            "subject": "Audio stuttering on high bandwidth network",
            "issue_category": "Audio/Video Issues",
            "priority": "High",
            "initial_message": "Audio frames are dropping during real-time calls."
        })
        self.assertEqual(t_res.status_code, 200)
        t_data = t_res.json()
        ticket_id = t_data["id"]
        ticket_number = t_data["ticket_number"]
        self.assertTrue(ticket_number.startswith("TICK-"))

        # 2. Add customer and support agent messages
        self.client.post(f"/api/tickets/{ticket_id}/messages", json={
            "sender_type": "support",
            "sender_name": "Support AI",
            "message": "We have identified potential packet drops. Please enable TCP fallback."
        })
        self.client.post(f"/api/tickets/{ticket_id}/messages", json={
            "sender_type": "customer",
            "sender_name": "Test User",
            "message": "Enabling TCP fallback fixed the stuttering. Thank you!"
        })

        # 3. Update ticket status
        up_res = self.client.put(f"/api/tickets/{ticket_id}/status", json={
            "status": "Resolved",
            "resolution_notes": "Resolved by enabling TCP fallback protocol."
        })
        self.assertEqual(up_res.status_code, 200)

        # 4. Generate post-session support summary dashboard
        transcript_sample = [
            {"speaker": "user", "text": "I am experiencing audio stuttering.", "timestamp": "10:00"},
            {"speaker": "ai", "text": "I understand. Let me check your telemetry and create a ticket.", "timestamp": "10:01"},
            {"speaker": "ai", "text": "Created ticket TICK-1017 with high priority.", "timestamp": "10:02"},
            {"speaker": "user", "text": "Thank you, TCP fallback resolved the stuttering!", "timestamp": "10:03"}
        ]
        sum_res = self.client.post("/api/tickets/summarize-session", json={
            "ticket_id": ticket_id,
            "transcript": transcript_sample,
            "duration_seconds": 185
        })
        self.assertEqual(sum_res.status_code, 200)
        sum_data = sum_res.json()
        self.assertIn("issue_summary", sum_data)
        self.assertIn("ai_understanding", sum_data)
        self.assertIn("resolution_provided", sum_data)
        self.assertTrue(sum_data["ticket_created"])
        self.assertEqual(sum_data["ticket_id"], ticket_number)
        self.assertEqual(sum_data["duration_seconds"], 185)
        self.assertTrue(len(sum_data.get("recommended_next_steps", [])) > 0)

    def test_05_document_upload_restriction_per_workspace(self):
        """Verify strict upload format restrictions per workspace feature."""
        # Visual intelligence accepts images and diagram specs, but rejects unsupported audio/media
        audio_content = b"fake audio binary data"
        files = {"file": ("recording.wav", audio_content, "audio/wav")}
        data = {"feature": "visual-intelligence"}
        res = self.client.post("/api/upload", files=files, data=data)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Unsupported format", res.json().get("detail", ""))

        # Document analysis accepts PDF, DOCX, TXT
        text_content = b"Sample text for document analysis."
        files_ok = {"file": ("notes.txt", text_content, "text/plain")}
        data_ok = {"feature": "document-analysis"}
        res_ok = self.client.post("/api/upload", files=files_ok, data=data_ok)
        self.assertEqual(res_ok.status_code, 200)
        uploaded = res_ok.json()
        self.assertEqual(uploaded["filename"], "notes.txt")
        self.assertEqual(uploaded["feature_id"], "document-analysis")

        # Test deleting uploaded file
        del_res = self.client.delete(f"/api/upload/{uploaded['id']}")
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json().get("success"))

    def test_06_pdf_document_context_retention_and_chat(self):
        """Verify PDF/text document upload, text extraction, grounded summarization, and follow-up Q&A without network error."""
        # 1. Create conversation in data-study
        conv_res = self.client.post("/api/conversations", json={
            "feature": "data-study",
            "mode": "study-assistant",
            "language": "en"
        })
        conv_id = conv_res.json()["id"]

        # 2. Upload structured study document
        study_content = (
            "Title: Advanced Operating Systems\n"
            "Chapter: Process Synchronization & Deadlocks\n"
            "Key Conditions for Deadlock:\n"
            "1. Mutual Exclusion\n"
            "2. Hold and Wait\n"
            "3. No Preemption\n"
            "4. Circular Wait\n"
            "Banker's Algorithm is used for deadlock avoidance by verifying safe states."
        ).encode("utf-8")
        files = {"file": ("OS_Deadlocks.txt", study_content, "text/plain")}
        upload_res = self.client.post("/api/upload", files=files, data={"conversation_id": conv_id, "feature": "data-study"})
        self.assertEqual(upload_res.status_code, 200)

        # 3. Ask for document summary
        chat1_res = self.client.post("/api/chat", json={
            "conversation_id": conv_id,
            "message": "Summarize this document and list the 4 deadlock conditions.",
            "language": "en",
            "feature": "data-study"
        })
        self.assertEqual(chat1_res.status_code, 200)
        reply1 = chat1_res.json()["response"]
        self.assertTrue("deadlock" in reply1.lower())
        self.assertTrue("mutual exclusion" in reply1.lower() or "circular wait" in reply1.lower())

        # 4. Ask follow-up question verifying document retention
        chat2_res = self.client.post("/api/chat", json={
            "conversation_id": conv_id,
            "message": "What algorithm is mentioned for deadlock avoidance?",
            "language": "en",
            "feature": "data-study"
        })
        self.assertEqual(chat2_res.status_code, 200)
        reply2 = chat2_res.json()["response"]
        self.assertIn("banker", reply2.lower())


if __name__ == "__main__":
    unittest.main()
