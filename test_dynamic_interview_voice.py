"""
Comprehensive Verification Test Suite for SeeSpeak AI Interview Module:
1. Turn Aggregation & Paragraph Deduplication (VoiceSession)
2. Natural-Language Request Understanding in Mock & Live (Repeat, Clarify, Example, Skip, Slower, End)
3. Dynamic Contextual Follow-up Generation
4. Evidence-Grounded Dynamic Evaluation with Contrasting Transcripts (High vs Low performance)
5. Interview Persistence & Retrieval Lifecycle
"""
import unittest
import asyncio
import os
import sys

# Ensure backend is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from backend.core.session_manager import VoiceSession
from backend.services.interview_evaluator import evaluate_interview_session
from backend.providers.realtime.mock_realtime import MockRealtimeProvider
from backend.repositories.interview_repository import interview_repository


class TestTurnAggregationAndDeduplication(unittest.TestCase):
    def test_user_speech_aggregation(self):
        """Verify partial fragments are accumulated into a single coherent paragraph turn."""
        session = VoiceSession(mode="ai-interview")
        
        # Candidate speaks in clauses
        session.append_user_speech("Actually I am a ")
        session.append_user_speech("computer science student ")
        session.append_user_speech("and I recently built a house price prediction model.")
        
        self.assertEqual(
            session.get_current_user_turn(),
            "Actually I am a computer science student and I recently built a house price prediction model."
        )
        
        # Finalize turn
        final_turn_text = session.finalize_user_turn()
        self.assertIsNotNone(final_turn_text)
        self.assertIn("house price prediction model", final_turn_text)
        self.assertEqual(len(session.transcripts), 1)
        self.assertEqual(session.transcripts[0]["role"], "user")
        self.assertEqual(session.get_current_user_turn(), "")

    def test_prevent_duplicate_consecutive_finalization(self):
        """Verify duplicate finalizations do not create ghost messages."""
        session = VoiceSession(mode="ai-interview")
        session.append_user_speech("Hello interviewer.")
        turn1 = session.finalize_user_turn()
        self.assertIsNotNone(turn1)
        
        # Second finalize with empty buffer should return None
        turn2 = session.finalize_user_turn()
        self.assertIsNone(turn2)
        self.assertEqual(len(session.transcripts), 1)


class TestRequestUnderstandingAndMockResponses(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.mock_provider = MockRealtimeProvider(
            mode="ai-interview",
            job_role="Backend Engineer",
            difficulty="Medium",
            num_questions=5,
        )
        await self.mock_provider.connect(system_prompt="You are an expert AI interviewer.")

    async def asyncTearDown(self):
        await self.mock_provider.close()

    async def test_intent_detection(self):
        """Verify intent classifier identifies user requests accurately."""
        self.assertEqual(self.mock_provider._detect_user_intent("Could you please repeat the question?"), "repeat")
        self.assertEqual(self.mock_provider._detect_user_intent("I don't understand, what do you mean?"), "clarify")
        self.assertEqual(self.mock_provider._detect_user_intent("Can you give me an example?"), "example")
        self.assertEqual(self.mock_provider._detect_user_intent("Can we skip this question and move on?"), "skip")
        self.assertEqual(self.mock_provider._detect_user_intent("Please speak more slowly, you are too fast."), "slower")
        self.assertEqual(self.mock_provider._detect_user_intent("I want to stop and end the interview now."), "end")
        self.assertEqual(self.mock_provider._detect_user_intent("I built a microservices backend in Python using FastAPI."), "answer")

    async def test_skip_question_turn_flow(self):
        """Candidate asks to skip the question; verify skipped index is recorded and next question asked."""
        # Initial kickoff
        self.mock_provider.has_greeted = True
        self.mock_provider.current_question_index = 0
        
        await self.mock_provider.send_text("Can we skip this question?")
        
        output_text = ""
        async for item in self.mock_provider.receive():
            if isinstance(item, dict) and item.get("type") == "output_transcript":
                output_text = item.get("text", "")
            if isinstance(item, dict) and item.get("type") == "turn_complete":
                break
                
        self.assertIn("move forward", output_text.lower())
        self.assertIn(0, self.mock_provider.skipped_questions)
        self.assertEqual(self.mock_provider.current_question_index, 1)

    async def test_speak_slower_turn_flow(self):
        """Candidate requests slower pace; verify speech modifier is updated."""
        self.mock_provider.has_greeted = True
        self.mock_provider.current_question_index = 0
        
        await self.mock_provider.send_text("Please speak more slowly.")
        
        output_text = ""
        async for item in self.mock_provider.receive():
            if isinstance(item, dict) and item.get("type") == "output_transcript":
                output_text = item.get("text", "")
            if isinstance(item, dict) and item.get("type") == "turn_complete":
                break
                
        self.assertIn("more slowly", output_text.lower())
        self.assertEqual(self.mock_provider.speech_speed_modifier, 0.8)

    async def test_contextual_adaptive_follow_up(self):
        """Interviewer acknowledges candidate's answer and asks relevant follow-up."""
        self.mock_provider.has_greeted = True
        self.mock_provider.current_question_index = 0
        
        candidate_answer = "I developed an AI pipeline for SeeSpeak AI to achieve sub-second voice latency and barge-in audio streaming."
        await self.mock_provider.send_text(candidate_answer)
        
        output_text = ""
        async for item in self.mock_provider.receive():
            if isinstance(item, dict) and item.get("type") == "output_transcript":
                output_text = item.get("text", "")
            if isinstance(item, dict) and item.get("type") == "turn_complete":
                break
                
        self.assertTrue(
            "sub-second" in output_text.lower() or "latency" in output_text.lower() or "audio" in output_text.lower() or "systems design" in output_text.lower(),
            f"Expected follow-up referencing candidate's specific answer, got: {output_text}"
        )


class TestDynamicEvidenceBasedEvaluation(unittest.TestCase):
    def test_evaluator_distinguishes_high_vs_low_transcripts(self):
        """Verify that contrasting transcripts produce significantly different scores and feedback."""
        # Candidate A: Strong, comprehensive technical answers
        strong_transcript = [
            {"speaker": "ai", "text": "Welcome to your interview. Can you describe an architectural challenge you solved?"},
            {
                "speaker": "user",
                "text": "At my previous role, our distributed microservices faced cascading timeouts due to unindexed SQL queries and high database contention. I introduced a Redis write-through cache for hot reads, partitioned the PostgreSQL tables by tenant ID, and configured connection pooling. This reduced our p99 query latency from 1.4 seconds to under 45 milliseconds and eliminated timeout errors across the cluster."
            },
            {"speaker": "ai", "text": "That is impressive. How did you handle cache invalidation and ensure data consistency?"},
            {
                "speaker": "user",
                "text": "We utilized an event-driven cache invalidation pattern via Kafka change-data-capture (CDC). When a record was modified, Debezium published a change event to Kafka, and a lightweight consumer evicted the corresponding Redis cache key with an exponential backoff retry. We also set a safety TTL of 15 minutes to guarantee eventual consistency."
            }
        ]

        # Candidate B: Weak answers, skipped questions, minimal technical detail
        weak_transcript = [
            {"speaker": "ai", "text": "Welcome to your interview. Can you describe an architectural challenge you solved?"},
            {"speaker": "user", "text": "I don't know, can we skip this question please?"},
            {"speaker": "ai", "text": "No problem, let's move forward. How do you test your software before deploying?"},
            {"speaker": "user", "text": "I just run it locally on my laptop and check if it works."}
        ]

        # Run evaluation on both
        eval_strong = evaluate_interview_session(
            interview_type="Senior Backend Engineer",
            language="en",
            transcript=strong_transcript,
            experience_metrics={"duration_seconds": 300, "interruptions": 0}
        )

        eval_weak = evaluate_interview_session(
            interview_type="Senior Backend Engineer",
            language="en",
            transcript=weak_transcript,
            experience_metrics={"duration_seconds": 120, "interruptions": 2}
        )

        score_strong = eval_strong["overall_score"]
        score_weak = eval_weak["overall_score"]

        # 1. Scores must be distinctly different (strong > weak)
        self.assertGreater(
            score_strong,
            score_weak + 20,
            f"Strong candidate score ({score_strong}) should be significantly higher than weak candidate ({score_weak})"
        )

        # 2. Strong candidate metrics must reflect high technical knowledge
        metrics_strong = eval_strong.get("performance_metrics", {})
        metrics_weak = eval_weak.get("performance_metrics", {})
        self.assertGreater(
            metrics_strong.get("technical_knowledge", 0),
            metrics_weak.get("technical_knowledge", 0),
        )

        # 3. Weak candidate evaluation must detect skipped questions
        skipped_count_weak = eval_weak.get("session_metrics", {}).get("skipped_questions", 0)
        self.assertGreaterEqual(
            skipped_count_weak,
            1,
            "Weak candidate evaluation should detect at least 1 skipped question."
        )

        # 4. Strengths & areas for improvement must be evidence-grounded
        self.assertTrue(len(eval_strong.get("strengths", [])) > 0)
        self.assertTrue(len(eval_weak.get("areas_for_improvement", [])) > 0)
        
        # Verify question analysis exists
        self.assertIn("question_analysis", eval_strong)
        self.assertIn("question_analysis", eval_weak)


class TestInterviewPersistenceAndRetrieval(unittest.TestCase):
    def test_complete_interview_lifecycle(self):
        """Test creating session, adding finalized turns, completing, and reloading."""
        # 1. Create interview session
        session_data = interview_repository.create_session(
            interview_type="System Design",
            language="en",
            experience_metrics={
                "job_role": "Cloud Architect",
                "experience_level": "Staff / Principal",
                "difficulty": "Hard",
                "num_questions": 5,
            }
        )
        interview_id = session_data["id"]
        self.assertTrue(interview_id.startswith("intv_"))

        # 2. Add finalized turns
        transcript = [
            {"speaker": "ai", "text": "Tell me how you approach multi-region disaster recovery."},
            {"speaker": "user", "text": "I implement an active-active architecture across three AWS regions with Route53 latency routing."}
        ]
        interview_repository.update_transcript(interview_id, transcript)

        # 3. Evaluate and complete interview
        evaluation = evaluate_interview_session(
            interview_type="System Design",
            language="en",
            transcript=transcript,
            experience_metrics={"duration_seconds": 240, "interruptions": 1}
        )
        completed = interview_repository.complete_session(
            session_id=interview_id,
            evaluation=evaluation,
            duration_seconds=240,
            experience_metrics={"duration_seconds": 240, "interruptions": 1}
        )
        self.assertIsNotNone(completed)
        self.assertEqual(completed["status"], "completed")
        self.assertIn("evaluation", completed)
        self.assertIn("overall_score", completed["evaluation"])

        # 4. Reload from database
        reloaded = interview_repository.get_session(interview_id)
        self.assertIsNotNone(reloaded)
        self.assertEqual(reloaded["id"], interview_id)
        self.assertEqual(reloaded["status"], "completed")
        self.assertEqual(reloaded["evaluation"]["overall_score"], completed["evaluation"]["overall_score"])


if __name__ == "__main__":
    unittest.main()
