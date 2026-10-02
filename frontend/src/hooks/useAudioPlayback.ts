import { useRef, useCallback, useState, useEffect } from 'react';

interface UseAudioPlaybackOptions {
  initialSampleRate?: number;
  onPlaybackEnded?: () => void;
}

export function useAudioPlayback(options: number | UseAudioPlaybackOptions = 24000) {
  const initialRate = typeof options === 'number' ? options : options.initialSampleRate || 24000;
  const onPlaybackEndedCallback = typeof options === 'object' ? options.onPlaybackEnded : undefined;

  const [isPlaying, setIsPlaying] = useState(false);
  const sampleRateRef = useRef<number>(initialRate);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const playbackSpeedRef = useRef<number>(1.0);
  const scheduledEndTimerRef = useRef<number | null>(null);
  const onPlaybackEndedRef = useRef<(() => void) | undefined>(onPlaybackEndedCallback);

  useEffect(() => {
    onPlaybackEndedRef.current = onPlaybackEndedCallback;
  }, [onPlaybackEndedCallback]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtxClass();
      nextPlayTimeRef.current = 0;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  const resumeAudioContext = useCallback(async () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
        console.debug('[VOICE] AudioContext resumed via user gesture, state:', ctx.state);
      }
    } catch (e) {
      console.warn('[VOICE] Could not resume AudioContext on gesture:', e);
    }
  }, [getAudioContext]);

  const setSampleRate = useCallback((rate: number) => {
    if (rate && rate > 0) {
      sampleRateRef.current = rate;
      console.info(`[VOICE] Audio playback sample rate set to: ${rate}Hz`);
    }
  }, []);

  const setPlaybackSpeed = useCallback((speed: number) => {
    if (speed >= 0.5 && speed <= 2.0) {
      playbackSpeedRef.current = speed;
      console.info(`[VOICE] Audio playback speed rate set to: ${speed}x`);
    }
  }, []);

  const stop = useCallback(() => {
    if (scheduledEndTimerRef.current) {
      window.clearTimeout(scheduledEndTimerRef.current);
      scheduledEndTimerRef.current = null;
    }

    // Immediately stop and disconnect all playing/queued sources
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    });
    activeSourcesRef.current = [];

    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    } else {
      nextPlayTimeRef.current = 0;
    }
    setIsPlaying(false);
  }, []);

  const markTurnComplete = useCallback(() => {
    if (scheduledEndTimerRef.current) {
      window.clearTimeout(scheduledEndTimerRef.current);
      scheduledEndTimerRef.current = null;
    }

    const audioCtx = audioContextRef.current;
    if (!audioCtx || audioCtx.state === 'closed') {
      setIsPlaying(false);
      onPlaybackEndedRef.current?.();
      return;
    }

    const currentTime = audioCtx.currentTime;
    const finishTime = nextPlayTimeRef.current;

    if (finishTime <= currentTime && activeSourcesRef.current.length === 0) {
      setIsPlaying(false);
      console.debug('[VOICE] AI turn finished immediately, no queued audio');
      onPlaybackEndedRef.current?.();
      return;
    }

    const remainingMs = Math.max(30, (finishTime - currentTime) * 1000 + 60);
    console.debug(`[VOICE] AI turn complete received, waiting ${Math.round(remainingMs)}ms for audio playback to finish`);

    scheduledEndTimerRef.current = window.setTimeout(() => {
      scheduledEndTimerRef.current = null;
      activeSourcesRef.current = [];
      setIsPlaying(false);
      console.debug('[VOICE] AI audio playback completed in speakers');
      onPlaybackEndedRef.current?.();
    }, remainingMs);
  }, []);

  const playChunk = useCallback(
    (pcmData: ArrayBuffer) => {
      try {
        if (!pcmData || pcmData.byteLength === 0) return;

        // Ensure safe byte length for Int16Array (must be multiple of 2)
        const safeByteLength = pcmData.byteLength - (pcmData.byteLength % 2);
        if (safeByteLength < 2) return;
        const safeBuffer = pcmData.byteLength === safeByteLength ? pcmData : pcmData.slice(0, safeByteLength);

        const audioCtx = getAudioContext();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }

        const int16Array = new Int16Array(safeBuffer);
        if (int16Array.length === 0) return;

        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }

        // Web Audio creates buffer with incoming sample rate (24000Hz) and resamples to device rate
        const audioBuffer = audioCtx.createBuffer(1, float32Array.length, sampleRateRef.current);
        audioBuffer.getChannelData(0).set(float32Array);

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        if (playbackSpeedRef.current !== 1.0) {
          source.playbackRate.value = playbackSpeedRef.current;
        }
        source.connect(audioCtx.destination);

        const currentTime = audioCtx.currentTime;
        // Schedule next chunk sequentially with tiny 20ms jitter buffer to prevent overlap/gaps
        let startTime = nextPlayTimeRef.current;
        if (startTime < currentTime || startTime === 0) {
          startTime = currentTime + 0.02;
        }

        source.start(startTime);
        const effectiveDuration = audioBuffer.duration / (playbackSpeedRef.current || 1.0);
        nextPlayTimeRef.current = startTime + effectiveDuration;

        activeSourcesRef.current.push(source);
        setIsPlaying(true);

        source.onended = () => {
          activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        };
      } catch (e) {
        console.error('[VOICE] Error during audio chunk playback:', e);
      }
    },
    [getAudioContext]
  );

  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stop]);

  return {
    isPlaying,
    playChunk,
    stop,
    markTurnComplete,
    setSampleRate,
    setPlaybackSpeed,
    resumeAudioContext,
  };
}
