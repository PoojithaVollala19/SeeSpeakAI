import os
import json
import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.repositories.ticket_repository import TicketRepository
from backend.repositories.interview_repository import InterviewRepository
from backend.services.interview_evaluator import evaluate_interview_session, RUBRIC_METHODOLOGY
from backend.routes.chat_routes import LANGUAGE_PROMPT_INSTRUCTIONS

client = TestClient(app)

class TestSeeSpeakUpgrades(unittest.TestCase):
    def test_health_check(self):
        """Verify backend health and safe configuration without exposing secrets."""
        response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "online")
        self.assertIn("has_gemini_key", data)
        # Ensure no secret key is leaked in the response
        self.assertNotIn("AIza", json.dumps(data))
        self.assertNotIn("AQ.", json.dumps(data))

    def test_multilingual_coverage(self):
        """Verify all 17 required languages are configured in system prompts and i18n."""
        expected_languages = [
            "en", "te", "hi", "ta", "kn", "ml", "bn", "mr", "gu", "pa", "ur",
            "es", "fr", "de", "ja", "ko", "zh"
        ]
        for lang in expected_languages:
            self.assertIn(lang, LANGUAGE_PROMPT_INSTRUCTIONS, f"Missing prompt instructions for language: {lang}")
            instruction = LANGUAGE_PROMPT_INSTRUCTIONS[lang]
            self.assertGreater(len(instruction), 10, f"Instruction too short for language: {lang}")

    def test_interview_session_lifecycle(self):
        """Test full interview lifecycle: creation, continuous transcript turns, completion, rubric evaluation."""
        # 1. Create interview session
        create_payload = {
            "user_id": "test_user_001",
            "interview_type": "Software Engineering",
            "language": "en"
        }
        create_res = client.post("/api/interview/sessions", json=create_payload)
        self.assertEqual(create_res.status_code, 200, create_res.text)
        session = create_res.json()
        session_id = session["id"]
        self.assertEqual(session["interview_type"], "Software Engineering")
        self.assertEqual(session["language"], "en")
        self.assertEqual(session["status"], "in_progress")

        # 2. Append continuous conversation turns (one single conversation transcript)
        turns = [
            {
                "speaker": "ai",
                "text": "Hello! Welcome to your Software Engineering interview. Could you explain the difference between a process and a thread?",
                "timestamp": "2026-09-30T10:00:00Z",
                "language": "en"
            },
            {
                "speaker": "user",
                "text": "A process is an executing instance of a program with its own dedicated memory address space, whereas a thread is the smallest unit of execution that lives inside a process and shares memory with sibling threads.",
                "timestamp": "2026-09-30T10:00:30Z",
                "language": "en"
            },
            {
                "speaker": "ai",
                "text": "Great answer. Now how do you handle race conditions when multiple threads access shared resources?",
                "timestamp": "2026-09-30T10:00:45Z",
                "language": "en"
            },
            {
                "speaker": "user",
                "text": "Race conditions can be prevented using synchronization primitives such as mutex locks, semaphores, read-write locks, or atomic operations depending on contention.",
                "timestamp": "2026-09-30T10:01:20Z",
                "language": "en"
            }
        ]

        transcript_res = client.post(
            f"/api/interview/sessions/{session_id}/transcript",
            json={"transcript": turns}
        )
        self.assertEqual(transcript_res.status_code, 200)
        saved_turns = transcript_res.json()["transcript"]
        self.assertEqual(len(saved_turns), 4)
        self.assertEqual(saved_turns[0]["speaker"], "ai")
        self.assertEqual(saved_turns[1]["speaker"], "user")

        # 3. Retrieve session details
        get_res = client.get(f"/api/interview/sessions/{session_id}")
        self.assertEqual(get_res.status_code, 200)
        session_data = get_res.json()
        self.assertEqual(len(session_data["transcript"]), 4)

        # 4. Complete interview and generate evaluation
        complete_payload = {
            "duration": 180,
            "experience_metrics": {
                "duration_seconds": 180,
                "interruptions_count": 1,
                "speaking_activity": "balanced",
                "transcript_turn_count": 4,
                "camera_enabled": True,
                "screen_share_enabled": False,
                "language": "en"
            }
        }
        complete_res = client.post(
            f"/api/interview/sessions/{session_id}/complete",
            json=complete_payload
        )
        self.assertEqual(complete_res.status_code, 200, complete_res.text)
        completed_data = complete_res.json()
        self.assertEqual(completed_data["status"], "completed")
        self.assertEqual(completed_data["duration"], 180)
        self.assertIn("evaluation", completed_data)
        evaluation = completed_data["evaluation"]

        # Verify defined 8-metric rubric
        scores = evaluation.get("performance_metrics") or evaluation.get("scores", {})
        required_metrics = [
            "communication", "clarity", "relevance", "technical_knowledge",
            "problem_solving", "completeness", "consistency", "engagement"
        ]
        for metric in required_metrics:
            self.assertIn(metric, scores, f"Missing rubric metric: {metric}")
            self.assertTrue(0 <= scores[metric] <= 100, f"Score out of bounds for {metric}: {scores[metric]}")

        # Verify strengths, areas for improvement, recommendations
        self.assertGreater(len(evaluation.get("strengths", [])), 0)
        self.assertGreater(len(evaluation.get("areas_for_improvement", [])), 0)
        self.assertGreater(len(evaluation.get("recommendations", [])), 0)

        # Verify question-by-question analysis
        qa_list = evaluation.get("question_analysis", [])
        self.assertGreaterEqual(len(qa_list), 2)
        self.assertIn("process and a thread", qa_list[0]["question"].lower())
        self.assertGreater(len(qa_list[0]["strengths"]), 0)

        # 5. Verify list endpoint
        list_res = client.get("/api/interview/sessions?user_id=test_user_001")
        self.assertEqual(list_res.status_code, 200)
        sessions_data = list_res.json()
        sessions = sessions_data if isinstance(sessions_data, list) else sessions_data.get("sessions", [])
        self.assertTrue(any(s["id"] == session_id for s in sessions))

    def test_support_ticket_lifecycle_and_context(self):
        """Test full customer support ticket flow: creation, messages, status update, search, and AI context grounding."""
        # 1. Create a support ticket
        ticket_payload = {
            "user_id": "cust_user_42",
            "subject": "Audio streaming delay in voice call",
            "description": "During live voice calls, there is a 3-second latency before AI speech starts.",
            "category": "technical",
            "priority": "high",
            "language": "en"
        }
        create_res = client.post("/api/tickets", json=ticket_payload)
        self.assertEqual(create_res.status_code, 200, create_res.text)
        ticket = create_res.json()
        ticket_id = ticket["id"]
        self.assertTrue(ticket["ticket_number"].startswith("TICK-"))
        self.assertEqual(ticket["status"], "Open")
        self.assertEqual(ticket["priority"], "high")

        # 2. Add ticket messages
        msg_1 = {
            "sender_type": "customer",
            "message": "I checked my network connection and it is 100Mbps download, so it seems server-side."
        }
        msg_res_1 = client.post(f"/api/tickets/{ticket_id}/messages", json=msg_1)
        self.assertEqual(msg_res_1.status_code, 200)

        msg_2 = {
            "sender_type": "support",
            "message": "Thank you for the additional details. We are investigating the audio buffer settings."
        }
        msg_res_2 = client.post(f"/api/tickets/{ticket_id}/messages", json=msg_2)
        self.assertEqual(msg_res_2.status_code, 200)

        # 3. Retrieve ticket with message history (initial description + 2 added messages)
        get_res = client.get(f"/api/tickets/{ticket_id}")
        self.assertEqual(get_res.status_code, 200)
        ticket_detail = get_res.json()
        self.assertEqual(len(ticket_detail["messages"]), 3)
        self.assertIn(ticket_detail["messages"][0]["sender_type"], ["user", "customer"])
        self.assertIn(ticket_detail["messages"][1]["sender_type"], ["user", "customer"])
        self.assertEqual(ticket_detail["messages"][2]["sender_type"], "support")

        # 4. Update status
        patch_res = client.patch(f"/api/tickets/{ticket_id}/status", json={"status": "In Progress"})
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["status"], "In Progress")

        # 5. Check AI context generation for voice & chat grounding
        context_res = client.get(f"/api/tickets/{ticket_id}/context")
        self.assertEqual(context_res.status_code, 200)
        context_prompt = context_res.json()["context_prompt"]
        self.assertIn(ticket["ticket_number"], context_prompt)
        self.assertIn("Audio streaming delay", context_prompt)
        self.assertIn("In Progress", context_prompt)
        self.assertIn("investigating the audio buffer", context_prompt)

        # 6. Test chat with ticket context
        chat_res = client.post("/api/chat", json={
            "message": "Can you check the current status of my audio latency ticket?",
            "ticket_id": ticket_id,
            "feature": "customer-service",
            "language": "en"
        })
        self.assertEqual(chat_res.status_code, 200)
        chat_data = chat_res.json()
        self.assertIn("response", chat_data)

        # 7. Test ticket listing and filtering
        list_res = client.get("/api/tickets?status=In Progress")
        self.assertEqual(list_res.status_code, 200)
        tickets_data = list_res.json()
        tickets = tickets_data if isinstance(tickets_data, list) else tickets_data.get("tickets", [])
        self.assertTrue(any(t["id"] == ticket_id for t in tickets))

    def test_voice_websocket_interruption_barge_in(self):
        """Verify WebSocket connection handles session_start, ticket context, and interruption events cleanly."""
        with client.websocket_connect("/ws/session") as websocket:
            # 1. Initialize session with interview mode and mock voice provider
            websocket.send_text(json.dumps({
                "type": "session_start",
                "mode": "interviewer",
                "language": "en",
                "voice_mode": "mock"
            }))
            init_reply = websocket.receive_text()
            init_data = json.loads(init_reply)
            self.assertEqual(init_data["type"], "session_ready")
            self.assertIn(init_data["voice_mode"], ["gemini", "mock"])

            # 2. Simulate barge-in interruption while agent is active
            websocket.send_text(json.dumps({
                "type": "interrupt"
            }))
            interrupted_reply = websocket.receive_text()
            int_data = json.loads(interrupted_reply)
            self.assertEqual(int_data["type"], "interrupt")


if __name__ == "__main__":
    unittest.main()
