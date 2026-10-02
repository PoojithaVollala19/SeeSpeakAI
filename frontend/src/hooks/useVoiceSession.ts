import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { useMicrophone } from './useMicrophone';
import { useAudioPlayback } from './useAudioPlayback';
import { VoiceSessionMode, VoiceState, InterviewState, RealtimeServerEvent, SupportedLanguage, TranscriptTurn } from '../types';

export interface TranscriptItem {
  id: string;
  role: 'user' | 'agent';
  text: string;
  isFinal: boolean;
  timestamp: Date;
  language?: string;
  status?: string;
}

function isInternalThought(text: string): boolean {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  const thoughtPrefixes = [
    'refining the initial question',
    'refining initial question',
    'initiating interview protocol',
    'initiating interview',
    'analyzing candidate response',
    'analyzing candidate',
    'evaluating response',
    'evaluating candidate response',
    'preparing the next question',
    'preparing next question',
    'generating next question',
    'generating question',
    'selecting next question',
    'interview protocol',
    'protocol:',
    'thinking...',
    'ai is thinking',
    'processing...',
    'processing candidate response',
    'processing answer',
    'thought:',
    'internal reasoning',
    'internal prompt',
    'competency evaluated',
    'competency remaining',
    'state: processing_answer'
  ];
  if (thoughtPrefixes.some((p) => t.startsWith(p))) return true;
  if (['refining', 'thinking', 'protocol', 'analyzing', 'generating', 'processing'].includes(t)) return true;
  if (
    t.includes('refining the initial question') ||
    t.includes('initiating interview protocol') ||
    t.includes('ai is thinking') ||
    t.includes('processing candidate response') ||
    t.includes('processing answer') ||
    t.includes('evaluating response') ||
    t.includes('selecting next question') ||
    t.includes('internal reasoning')
  ) {
    return true;
  }
  if (t.startsWith('{') && t.endsWith('}')) return true;
  return false;
}

interface UseVoiceSessionOptions {
  mode: VoiceSessionMode | string;
  conversationId?: string;
  language?: SupportedLanguage;
  ticketId?: string;
  interviewType?: string;
  interviewSessionId?: string;
  jobRole?: string;
  experienceLevel?: string;
  difficulty?: string;
  jobDescription?: string;
  resumeContext?: Record<string, any> | null;
  silenceDurationMs?: number;
}

const DEFAULT_ANSWER_SILENCE_MS = 1500;

export function useVoiceSession({
  mode,
  conversationId,
  language = 'en',
  ticketId,
  interviewType,
  interviewSessionId,
  jobRole,
  experienceLevel,
  difficulty,
  jobDescription,
  resumeContext,
  silenceDurationMs = DEFAULT_ANSWER_SILENCE_MS,
}: UseVoiceSessionOptions) {
  // Authoritative State Machine
  const [interviewState, setInterviewState] = useState<InterviewState>('idle');
  const interviewStateRef = useRef<InterviewState>('idle');
  useEffect(() => {
    interviewStateRef.current = interviewState;
  }, [interviewState]);

  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [voiceMode, setVoiceMode] = useState<string>('gemini');
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [interruptionCount, setInterruptionCount] = useState<number>(0);

  // Turn tracking, concurrency lock, and silence/processing timers
  const silenceTimerRef = useRef<number | null>(null);
  const processingTimeoutRef = useRef<number | null>(null);
  const isGeneratingNextQuestionRef = useRef<boolean>(false);
  const activeSessionIdRef = useRef<string | undefined>(interviewSessionId);
  const hasSpokenInCurrentTurnRef = useRef<boolean>(false);

  useEffect(() => {
    if (interviewSessionId) {
      activeSessionIdRef.current = interviewSessionId;
    }
  }, [interviewSessionId]);

  // Helper: Finalize any in-progress transcript
  const finalizePendingTranscripts = useCallback((forRole?: 'user' | 'agent') => {
    setTranscripts((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (!last.isFinal && (!forRole || last.role === forRole)) {
        const updated = [...prev];
        updated[updated.length - 1] = { ...last, isFinal: true };
        return updated;
      }
      return prev;
    });
  }, []);

  // Audio Playback Hook with precise turn finish callback
  const {
    isPlaying,
    playChunk,
    stop: stopAudioPlayback,
    markTurnComplete,
    setSampleRate,
    setPlaybackSpeed,
    resumeAudioContext,
  } = useAudioPlayback({
    initialSampleRate: 24000,
    onPlaybackEnded: () => {
      console.log('[INTERVIEW] AI audio playback completed in speakers');
      // Transition from AI_SPEAKING or PROCESSING_ANSWER to WAITING_FOR_CANDIDATE
      if (interviewStateRef.current === 'ai_speaking' || interviewStateRef.current === 'processing_answer') {
        console.log('[INTERVIEW] state: WAITING_FOR_CANDIDATE');
        setInterviewState('waiting_for_candidate');
        hasSpokenInCurrentTurnRef.current = false;
        isGeneratingNextQuestionRef.current = false;
      }
    },
  });

  // Finalize candidate answer and trigger AI processing
  const finalizeCandidateAnswer = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (interviewStateRef.current !== 'candidate_speaking') {
      return;
    }

    // CONCURRENCY LOCK: Prevent duplicate generation requests
    if (isGeneratingNextQuestionRef.current) {
      console.warn('[INTERVIEW] Next question generation already in progress, skipping duplicate');
      return;
    }
    isGeneratingNextQuestionRef.current = true;

    console.log('[INTERVIEW] candidate speech ended (silence threshold met)');
    finalizePendingTranscripts('user');
    console.log('[INTERVIEW] candidate answer finalized');
    console.log('[INTERVIEW] state: PROCESSING_ANSWER');
    setInterviewState('processing_answer');

    // PROCESSING TIMEOUT RECOVERY: If Gemini/backend hangs, recover safely after 8s
    if (processingTimeoutRef.current) {
      window.clearTimeout(processingTimeoutRef.current);
    }
    processingTimeoutRef.current = window.setTimeout(() => {
      if (interviewStateRef.current === 'processing_answer') {
        console.warn('[INTERVIEW] Processing answer timeout (8s) reached. Recovering state to waiting_for_candidate.');
        setInterviewState('waiting_for_candidate');
        isGeneratingNextQuestionRef.current = false;
      }
    }, 8000);

    // Notify backend that user has completed their spoken turn
    wsSendJsonRef.current({ type: 'user_silent' });
  }, [finalizePendingTranscripts]);

  // WebSocket Hook
  const ws = useWebSocket({
    onOpen: () => {
      console.info('[INTERVIEW] websocket connected, establishing session...');
      ws.sendJson({
        type: 'session_start',
        mode: mode,
        feature_id: mode,
        module: mode,
        input_mode: 'voice',
        conversation_id: conversationId,
        language: language,
        ticket_id: ticketId,
        interview_type: interviewType,
        interview_session_id: activeSessionIdRef.current || interviewSessionId,
        job_role: jobRole,
        position: jobRole,
        experience_level: experienceLevel,
        difficulty: difficulty,
        job_description: jobDescription,
        resume_context: resumeContext,
      });
      setInterviewState('connecting');
      console.log('[INTERVIEW] state: CONNECTING');
    },
    onClose: () => {
      console.info('[INTERVIEW] websocket closed');
      if (interviewStateRef.current !== 'ended' && interviewStateRef.current !== 'idle') {
        setInterviewState('ended');
      }
    },
    onError: () => {
      console.error('[INTERVIEW] websocket connection error');
      setErrorMessage('Connection error. Please check if the backend server is running on port 8000.');
      setInterviewState('error');
    },
    onJsonMessage: (event: RealtimeServerEvent) => {
      switch (event.type) {
        case 'session_ready':
          console.info('[INTERVIEW] Gemini session ready, mode:', event.voice_mode);
          if (event.sample_rate) {
            setSampleRate(event.sample_rate);
          }
          if (event.voice_mode) {
            setVoiceMode(event.voice_mode);
          }
          break;

        case 'user_speaking':
          // If server reports user speaking while candidate is active
          if (interviewStateRef.current === 'waiting_for_candidate') {
            console.log('[INTERVIEW] candidate speech started via STT');
            setInterviewState('candidate_speaking');
          }
          break;

        case 'agent_speaking':
          console.log('[INTERVIEW] state: AI_SPEAKING');
          if (silenceTimerRef.current) {
            window.clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (processingTimeoutRef.current) {
            window.clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }
          isGeneratingNextQuestionRef.current = false;
          // Finalize user turn once agent begins speaking
          finalizePendingTranscripts('user');
          setInterviewState('ai_speaking');
          if (event.latency !== undefined && event.latency !== null) {
            setLatencyMs(event.latency);
          }
          break;

        case 'turn_complete':
          console.log('[INTERVIEW] AI turn completed by provider');
          if (processingTimeoutRef.current) {
            window.clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }
          isGeneratingNextQuestionRef.current = false;
          finalizePendingTranscripts('agent');
          // Signal audio playback to finalize once scheduled buffers drain
          markTurnComplete();
          if (!isPlaying) {
            if (interviewStateRef.current === 'ai_speaking' || interviewStateRef.current === 'processing_answer') {
              setInterviewState('waiting_for_candidate');
              hasSpokenInCurrentTurnRef.current = false;
            }
          }
          break;

        case 'interrupt':
          console.log('[INTERVIEW] Interrupt event received');
          if (processingTimeoutRef.current) {
            window.clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }
          isGeneratingNextQuestionRef.current = false;
          stopAudioPlayback();
          setInterruptionCount((prev) => prev + 1);
          finalizePendingTranscripts('agent');
          if (interviewStateRef.current === 'ai_speaking') {
            setInterviewState('waiting_for_candidate');
          }
          break;

        case 'latency':
          if (event.latency_ms !== undefined) {
            setLatencyMs(event.latency_ms);
          }
          break;

        case 'transcript':
          if (event.role && event.text) {
            const role = event.role as 'user' | 'agent';
            const cleanText = event.text.trim();
            if (!cleanText || isInternalThought(cleanText)) return;

            setTranscripts((prev) => {
              const last = prev[prev.length - 1];

              // Deduplication check: identical finalized message
              if (last && last.role === role && last.text === cleanText && last.isFinal && event.is_final) {
                return prev;
              }

              // Update in-place on current turn
              if (last && last.role === role && !last.isFinal) {
                let mergedText = cleanText;
                if (cleanText.startsWith(last.text)) {
                  mergedText = cleanText;
                } else if (last.text.endsWith(cleanText)) {
                  mergedText = last.text;
                } else if (!cleanText.includes(last.text) && !last.text.includes(cleanText)) {
                  mergedText = `${last.text} ${cleanText}`;
                }

                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...last,
                  text: mergedText,
                  isFinal: !!event.is_final,
                };
                return updated;
              }

              // Create ONE new turn bubble
              return [
                ...prev,
                {
                  id: `turn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                  role: role,
                  text: cleanText,
                  isFinal: !!event.is_final,
                  timestamp: new Date(),
                },
              ];
            });
          }
          break;

        case 'internal_event':
          console.debug('[INTERVIEW] Telemetry event (never added to transcript):', event);
          break;

        case 'error':
          console.error('[INTERVIEW] Voice service error event:', event.message);
          if (processingTimeoutRef.current) {
            window.clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }
          isGeneratingNextQuestionRef.current = false;
          setErrorMessage(event.message || 'Voice service error encountered.');
          setInterviewState('error');
          break;
      }
    },
    onBinaryMessage: (data: ArrayBuffer) => {
      // Received 24kHz PCM16 audio chunk from agent
      if (processingTimeoutRef.current) {
        window.clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
      isGeneratingNextQuestionRef.current = false;
      if (interviewStateRef.current !== 'ai_speaking') {
        console.log('[INTERVIEW] Audio chunk received -> AI_SPEAKING');
        setInterviewState('ai_speaking');
      }
      playChunk(data);
    },
  });

  const wsSendJsonRef = useRef(ws.sendJson);
  const wsSendBinaryRef = useRef(ws.sendBinary);
  useEffect(() => {
    wsSendJsonRef.current = ws.sendJson;
    wsSendBinaryRef.current = ws.sendBinary;
  });

  // Calculate RMS energy of 16-bit PCM chunk
  const calculateRms = (buffer: ArrayBuffer): number => {
    const int16 = new Int16Array(buffer);
    if (int16.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < int16.length; i++) {
      const normalized = int16[i] / 32768.0;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / int16.length);
  };

  // Microphone audio chunk handler with strict gating
  const handleMicrophoneChunk = useCallback(
    (chunk: ArrayBuffer) => {
      if (isMuted) return;

      const currentState = interviewStateRef.current;

      // CONCURRENCY RULE #1: Drop microphone audio completely during AI speaking, connecting, processing, or ended
      if (
        currentState === 'ai_speaking' ||
        currentState === 'connecting' ||
        currentState === 'processing_answer' ||
        currentState === 'ending' ||
        currentState === 'ended' ||
        currentState === 'idle'
      ) {
        return;
      }

      const rms = calculateRms(chunk);
      const SPEECH_THRESHOLD = 0.025; // Sensible threshold for voice activity

      // When waiting for candidate and speech energy exceeds threshold -> transition to CANDIDATE_SPEAKING
      if (currentState === 'waiting_for_candidate') {
        if (rms > SPEECH_THRESHOLD) {
          console.log('[INTERVIEW] candidate speech started');
          console.log('[INTERVIEW] state: CANDIDATE_SPEAKING');
          setInterviewState('candidate_speaking');
          hasSpokenInCurrentTurnRef.current = true;
          wsSendBinaryRef.current(chunk);

          if (silenceTimerRef.current) {
            window.clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = window.setTimeout(finalizeCandidateAnswer, silenceDurationMs);
        }
        return;
      }

      // When candidate is actively speaking
      if (currentState === 'candidate_speaking') {
        wsSendBinaryRef.current(chunk);

        // Reset silence timer on speech
        if (rms > SPEECH_THRESHOLD * 0.7) {
          if (silenceTimerRef.current) {
            window.clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = window.setTimeout(finalizeCandidateAnswer, silenceDurationMs);
        }
      }
    },
    [isMuted, finalizeCandidateAnswer, silenceDurationMs]
  );

  // Microphone Hook
  const mic = useMicrophone({
    onAudioChunk: handleMicrophoneChunk,
    targetSampleRate: 16000,
  });

  // Track mic errors
  useEffect(() => {
    if (mic.error) {
      setErrorMessage(mic.error);
      setInterviewState('error');
    }
  }, [mic.error]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Interruption
  const interrupt = useCallback(() => {
    stopAudioPlayback();
    setInterruptionCount((prev) => prev + 1);
    finalizePendingTranscripts('agent');
    wsSendJsonRef.current({ type: 'interrupt' });
    setInterviewState('waiting_for_candidate');
  }, [stopAudioPlayback, finalizePendingTranscripts]);

  // Start Interview Session (Guarded against duplicate calls)
  const startSession = useCallback(
    async (customSessionId?: string) => {
      const currentState = interviewStateRef.current;
      if (
        currentState === 'connecting' ||
        currentState === 'ai_speaking' ||
        currentState === 'waiting_for_candidate' ||
        currentState === 'candidate_speaking' ||
        currentState === 'processing_answer'
      ) {
        console.warn('[INTERVIEW] Session already active, ignoring duplicate start request');
        return;
      }

      console.log('[INTERVIEW] Starting new interview session');
      setErrorMessage(null);
      setLatencyMs(null);
      setInterviewState('connecting');
      if (customSessionId) {
        activeSessionIdRef.current = customSessionId;
      }

      await resumeAudioContext();
      ws.connect();
      await mic.start();
      console.info('[INTERVIEW] microphone started');
    },
    [mic, resumeAudioContext, ws]
  );

  // Stop / End Interview Session
  const stopSession = useCallback(() => {
    console.log('[INTERVIEW] state: ENDING');
    setInterviewState('ending');

    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (processingTimeoutRef.current) {
      window.clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    isGeneratingNextQuestionRef.current = false;

    mic.stop();
    stopAudioPlayback();
    ws.disconnect();

    console.log('[INTERVIEW] state: ENDED');
    setInterviewState('ended');
  }, [mic, stopAudioPlayback, ws]);

  // Typed response submission adhering to the same state machine
  const sendTextMessage = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      console.log(`[INTERVIEW] Typed candidate response: "${clean}"`);

      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // Finalize candidate message in transcript
      setTranscripts((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'user' && !last.isFinal) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            text: clean,
            isFinal: true,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: `turn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            role: 'user',
            text: clean,
            isFinal: true,
            timestamp: new Date(),
          },
        ];
      });

      console.log('[INTERVIEW] state: PROCESSING_ANSWER');
      setInterviewState('processing_answer');

      wsSendJsonRef.current({
        type: 'user_text',
        text: clean,
      });
    },
    []
  );

  const sendVideoFrame = useCallback(
    (base64Data: string, mimeType: string = 'image/jpeg') => {
      wsSendJsonRef.current({
        type: 'video_frame',
        data: base64Data,
        mime_type: mimeType,
      });
    },
    []
  );

  // Continuous structured transcript for final evaluation
  const continuousTranscript: TranscriptTurn[] = transcripts
    .filter((t) => t.text.trim().length > 0)
    .map((t) => ({
      speaker: t.role === 'agent' ? 'ai' : 'user',
      text: t.text.trim(),
      timestamp: t.timestamp.toISOString(),
      language: language,
    }));

  return {
    voiceState: interviewState as VoiceState,
    interviewState,
    latencyMs,
    voiceMode,
    transcripts,
    continuousTranscript,
    audioLevel: isMuted ? 0 : mic.audioLevel,
    errorMessage,
    isConnected: ws.isConnected,
    isRecording: mic.isRecording,
    isPlaying,
    isMuted,
    interruptionCount,
    toggleMute,
    interrupt,
    startSession,
    stopSession,
    sendTextMessage,
    sendVideoFrame,
    setPlaybackSpeed,
    clearError: () => setErrorMessage(null),
  };
}
