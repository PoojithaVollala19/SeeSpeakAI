"""
Comprehensive Voice Pipeline Test Suite for SeeSpeak AI.
Verifies all 10 voice pipeline criteria:
1. WebSocket connection
2. session_ready handshake
3. Microphone / audio message handling (binary and JSON base64)
4. Gemini provider connection handling (live and mock)
5. User transcript event handling
6. AI response event handling
7. Audio forwarding
8. Duplicate event prevention
9. Session lifecycle (clean startup and teardown)
10. Barge-in / interruption
"""

import os
import sys
import json
import struct
import math
import asyncio
import unittest
from fastapi.testclient import TestClient

# Ensure backend can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.main import app
from backend.providers.realtime.gemini_live import GeminiLiveProvider
from backend.providers.realtime.mock_realtime import MockRealtimeProvider
from backend.providers.factory import get_realtime_provider


def generate_pcm16_tone(sample_rate: int = 16000, duration_sec: float = 0.5, freq: float = 440.0) -> bytes:
    """Generates synthetic 16kHz 16-bit PCM audio samples."""
    num_samples = int(sample_rate * duration_sec)
    buf = bytearray()
    for i in range(num_samples):
        val = int(10000 * math.sin(2 * math.pi * freq * (i / sample_rate)))
        buf.extend(struct.pack('<h', val))
    return bytes(buf)


def start_ws_session(ws, mode="ai-interview", language="en", voice_mode="mock"):
    """Sends session_start handshake and returns parsed session_ready message."""
    ws.send_text(json.dumps({
        "type": "session_start",
        "mode": mode,
        "language": language,
        "voice_mode": voice_mode,
        "job_role": "Software Engineer",
        "num_questions": 3
    }))
    raw = ws.receive_text()
    return json.loads(raw)


class TestVoicePipelineComprehensive(unittest.TestCase):

    def test_01_realtime_provider_factory(self):
        """Test provider selection: Mock when forced, Live when key is valid."""
        # 1. Force mock
        mock_p, mode = get_realtime_provider(voice_mode_override="mock", mode="ai-interview", language="en")
        self.assertIsInstance(mock_p, MockRealtimeProvider)
        self.assertEqual(mode, "mock")

        # 2. Check live when key is present and override is gemini
        gemini_key = os.getenv("GEMINI_API_KEY", "")
        if gemini_key and not gemini_key.startswith("your_"):
            live_p, mode = get_realtime_provider(voice_mode_override="gemini", mode="ai-interview", language="en")
            self.assertIsInstance(live_p, GeminiLiveProvider)
            self.assertEqual(mode, "gemini")
            self.assertEqual(live_p.input_sample_rate, 16000)
            self.assertEqual(live_p.output_sample_rate, 24000)

    def test_02_websocket_connection_and_session_ready(self):
        """Test WebSocket connection to /ws/session and receipt of session_ready."""
        client = TestClient(app)
        with client.websocket_connect("/ws/session") as ws:
            data = start_ws_session(ws, mode="ai-interview", voice_mode="mock")
            self.assertEqual(data.get("type"), "session_ready")
            self.assertTrue(data.get("session_id", "").startswith("sess_"))
            self.assertEqual(data.get("sample_rate"), 24000)
            self.assertEqual(data.get("voice_mode"), "mock")
            
            # Send client disconnect to test clean lifecycle
            ws.send_json({"type": "session_stop"})

    def test_03_microphone_binary_audio_handling(self):
        """Test sending binary 16kHz PCM16 audio chunks over WebSocket."""
        client = TestClient(app)
        with client.websocket_connect("/ws/session") as ws:
            data = start_ws_session(ws, mode="ai-interview", voice_mode="mock")
            self.assertEqual(data.get("type"), "session_ready")

            # Generate 16kHz PCM audio
            pcm_chunk = generate_pcm16_tone(sample_rate=16000, duration_sec=0.1)
            # Send binary frames
            for _ in range(5):
                ws.send_bytes(pcm_chunk)

            # Pipeline accepts without throwing errors
            ws.send_json({"type": "session_stop"})

    def test_04_microphone_json_base64_audio_handling(self):
        """Test sending base64-encoded audio chunk JSON frames over WebSocket."""
        import base64
        client = TestClient(app)
        with client.websocket_connect("/ws/session") as ws:
            data = start_ws_session(ws, mode="ai-interview", voice_mode="mock")
            self.assertEqual(data.get("type"), "session_ready")

            pcm_chunk = generate_pcm16_tone(sample_rate=16000, duration_sec=0.05)
            b64_data = base64.b64encode(pcm_chunk).decode("utf-8")
            
            ws.send_json({
                "type": "audio",
                "data": b64_data
            })
            ws.send_json({"type": "session_stop"})

    def test_05_barge_in_interruption_event(self):
        """Test barge-in interrupt signal handling."""
        client = TestClient(app)
        with client.websocket_connect("/ws/session") as ws:
            data = start_ws_session(ws, mode="ai-interview", voice_mode="mock")
            self.assertEqual(data.get("type"), "session_ready")

            # Send interrupt
            ws.send_json({"type": "interrupt"})
            
            # Read until interrupt confirmation is received
            interrupted = False
            for _ in range(5):
                try:
                    resp = ws.receive_text()
                    msg = json.loads(resp)
                    if msg.get("type") in ["interrupt", "interrupted"]:
                        interrupted = True
                        break
                except Exception:
                    break

            self.assertTrue(interrupted, "Expected to receive interrupt event from server")
            ws.send_json({"type": "session_stop"})

    def test_06_mock_speech_pause_turn_generation(self):
        """Test MockRealtimeProvider produces user transcript, AI turn, and audio."""
        client = TestClient(app)
        with client.websocket_connect("/ws/session") as ws:
            data = start_ws_session(ws, mode="ai-interview", voice_mode="mock")
            self.assertEqual(data.get("type"), "session_ready")

            # Send user text to trigger a turn directly
            ws.send_json({
                "type": "text",
                "text": "I have five years of experience building Python and React applications."
            })

            user_transcript_received = False
            ai_transcript_received = False
            audio_received = False

            # Collect responses
            for _ in range(20):
                try:
                    msg = ws.receive()
                    if "bytes" in msg:
                        audio_received = True
                    elif "text" in msg:
                        ev = json.loads(msg["text"])
                        role = ev.get("role") or ev.get("sender")
                        if ev.get("type") == "transcript" and role in ["user", "customer"]:
                            user_transcript_received = True
                        elif ev.get("type") == "transcript" and role in ["agent", "ai"]:
                            ai_transcript_received = True
                        elif ev.get("type") == "turn_complete":
                            break
                except Exception:
                    break

            self.assertTrue(user_transcript_received, "User transcript should be forwarded")
            self.assertTrue(ai_transcript_received, "AI response transcript should be generated")
            self.assertTrue(audio_received, "AI audio should be forwarded to client")

    def test_07_duplicate_event_prevention(self):
        """Verify that single user utterance doesn't produce duplicate final AI turns."""
        client = TestClient(app)
        with client.websocket_connect("/ws/session") as ws:
            data = start_ws_session(ws, mode="ai-interview", voice_mode="mock")
            self.assertEqual(data.get("type"), "session_ready")

            ws.send_json({
                "type": "text",
                "text": "Tell me about your technical stack."
            })

            ai_final_transcripts = []
            for _ in range(20):
                try:
                    msg = ws.receive()
                    if "text" in msg:
                        ev = json.loads(msg["text"])
                        role = ev.get("role") or ev.get("sender")
                        if ev.get("type") == "transcript" and role in ["agent", "ai"] and ev.get("is_final"):
                            ai_final_transcripts.append(ev.get("text"))
                        elif ev.get("type") == "turn_complete":
                            break
                except Exception:
                    break

            self.assertEqual(len(ai_final_transcripts), 1, "Exactly one final AI turn transcript should be emitted")

    def test_08_gemini_live_direct_connection_if_configured(self):
        """Test connecting directly to Gemini Live API if valid key is in environment."""
        gemini_key = os.getenv("GEMINI_API_KEY", "")
        if not gemini_key or gemini_key.startswith("your_"):
            self.skipTest("Valid GEMINI_API_KEY not provided; skipping direct live connection test.")

        async def run_live_test():
            provider = GeminiLiveProvider(mode="ai-interview", language="en")
            await provider.connect(system_prompt="You are a helpful AI interviewer.")
            self.assertTrue(provider._connected)
            
            # Send text turn to test generation
            await provider.send_text("Hello, this is an automated voice pipeline test.")
            
            received_any = False
            async for event in provider.receive():
                received_any = True
                break
                
            await provider.close()
            return received_any

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            success = loop.run_until_complete(asyncio.wait_for(run_live_test(), timeout=15.0))
            self.assertTrue(success, "Gemini Live API should produce real-time events")
        finally:
            loop.close()


if __name__ == "__main__":
    unittest.main()
