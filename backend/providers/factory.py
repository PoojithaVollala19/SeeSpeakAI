import os
from typing import Tuple
from backend.providers.base import BaseRealtimeProvider
from backend.providers.realtime.gemini_live import GeminiLiveProvider
from backend.providers.realtime.mock_realtime import MockRealtimeProvider
from backend.utils.logging import logger

def get_realtime_provider(voice_mode_override: str = None, **config_kwargs) -> Tuple[BaseRealtimeProvider, str]:
    """
    Factory function to select and instantiate the appropriate real-time provider.
    Returns (provider_instance, mode_name: 'gemini' | 'mock').
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    voice_mode = (voice_mode_override or os.getenv("VOICE_MODE", "gemini")).lower().strip()

    is_placeholder = bool(not api_key or "your_" in api_key.lower() or len(api_key) < 10 or "placeholder" in api_key.lower())
    if voice_mode == "mock" or not api_key or (is_placeholder and voice_mode_override != "gemini"):
        reason = "GEMINI_API_KEY missing/placeholder" if (not api_key or is_placeholder) else "VOICE_MODE=mock"
        logger.info(f"Using MockRealtimeProvider ({reason}) with kwargs: {list(config_kwargs.keys())}")
        mock_provider = MockRealtimeProvider(**config_kwargs)
        return mock_provider, "mock"

    try:
        provider = GeminiLiveProvider(api_key=api_key, **config_kwargs)
        logger.info("[VOICE] Initialized GeminiLiveProvider with official Google GenAI Live API")
        return provider, "gemini"
    except Exception as e:
        logger.warning(f"[VOICE] Failed to initialize GeminiLiveProvider ({e}), falling back to MockRealtimeProvider")
        mock_provider = MockRealtimeProvider(**config_kwargs)
        return mock_provider, "mock"
