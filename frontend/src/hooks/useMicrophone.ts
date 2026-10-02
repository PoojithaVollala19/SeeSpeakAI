import { useState, useRef, useCallback, useEffect } from 'react';

interface UseMicrophoneOptions {
  onAudioChunk?: (chunk: ArrayBuffer) => void;
  targetSampleRate?: number; // 16000
}

export function useMicrophone({ onAudioChunk, targetSampleRate = 16000 }: UseMicrophoneOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Store latest onAudioChunk in a ref to avoid stale closures
  const onAudioChunkRef = useRef(onAudioChunk);
  useEffect(() => {
    onAudioChunkRef.current = onAudioChunk;
  }, [onAudioChunk]);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);

  const stop = useCallback(() => {
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
      } catch (_) {}
      workletNodeRef.current = null;
    }

    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.onaudioprocess = null;
        scriptProcessorRef.current.disconnect();
      } catch (_) {}
      scriptProcessorRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (_) {}
      sourceRef.current = null;
    }

    if (muteGainRef.current) {
      try {
        muteGainRef.current.disconnect();
      } catch (_) {}
      muteGainRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch (_) {}
      audioContextRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);

    // 1. Verify browser mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = 'Microphone API is not supported in this browser. Please ensure you are running on localhost or HTTPS.';
      setError(err);
      return;
    }

    let stream: MediaStream;
    try {
      // 2. Request userMedia with ideal constraints
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access is blocked. Please allow microphone access in your browser address bar and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect an audio input device and try again.');
      } else {
        setError(`Microphone error: ${err.message || err.name}`);
      }
      setIsRecording(false);
      return;
    }

    // 3. Verify active audio track
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      setError('Microphone access was granted, but no active audio track was found.');
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;

    try {
      // 4. Create and resume AudioContext
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // 5. Connect microphone stream source
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // 6. Create a zero-gain node to prevent speaker feedback while keeping node alive
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;
      muteGain.connect(audioCtx.destination);
      muteGainRef.current = muteGain;

      let workletLoaded = false;

      // 7. Try loading AudioWorklet processor
      if (audioCtx.audioWorklet) {
        try {
          await audioCtx.audioWorklet.addModule('/audio-recorder-worklet.js');
          const workletNode = new AudioWorkletNode(audioCtx, 'audio-recorder-worklet');
          workletNodeRef.current = workletNode;

          workletNode.port.onmessage = (event) => {
            if (event.data?.type === 'audio_chunk') {
              const rms = event.data.audioLevel || 0;
              setAudioLevel(Math.min(1.0, rms * 4.5));
              if (onAudioChunkRef.current && event.data.pcmData) {
                onAudioChunkRef.current(event.data.pcmData);
              }
            }
          };

          source.connect(workletNode);
          workletNode.connect(muteGain);
          workletLoaded = true;
        } catch (workletErr) {
          console.warn('AudioWorklet load failed, falling back to ScriptProcessor:', workletErr);
          workletLoaded = false;
        }
      }

      // 8. Fallback: High-precision ScriptProcessor with 16kHz resampling
      if (!workletLoaded) {
        const bufferSize = 2048;
        const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
        scriptProcessorRef.current = processor;

        const sourceRate = audioCtx.sampleRate;
        const targetRate = targetSampleRate;
        const ratio = sourceRate / targetRate;
        let lastSample = 0;

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const inputLength = inputData.length;

          // Zero out output to prevent audio feedback
          const outputData = e.outputBuffer.getChannelData(0);
          outputData.fill(0);

          // Real RMS audio level calculation
          let sum = 0;
          for (let i = 0; i < inputLength; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputLength);
          setAudioLevel(Math.min(1.0, rms * 4.5));

          // Resample to 16kHz PCM16
          const outputSamples = Math.floor(inputLength / ratio);
          const pcm16 = new Int16Array(outputSamples);

          let phase = 0;
          let outIdx = 0;
          while (outIdx < outputSamples && phase < inputLength) {
            const index0 = Math.floor(phase);
            const frac = phase - index0;
            const s0 = index0 >= 0 ? inputData[index0] : lastSample;
            const s1 = index0 + 1 < inputLength ? inputData[index0 + 1] : s0;
            const interpolated = s0 + frac * (s1 - s0);

            const clamped = Math.max(-1, Math.min(1, interpolated));
            pcm16[outIdx++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
            phase += ratio;
          }
          lastSample = inputData[inputLength - 1];

          if (onAudioChunkRef.current && pcm16.length > 0) {
            onAudioChunkRef.current(pcm16.buffer);
          }
        };

        source.connect(processor);
        processor.connect(muteGain);
      }

      setIsRecording(true);
      console.info('[VOICE] microphone started');
    } catch (setupErr: any) {
      console.error('Audio processing setup error:', setupErr);
      setError(`Audio processing setup failed: ${setupErr.message}`);
      stop();
    }
  }, [stop, targetSampleRate]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isRecording,
    audioLevel,
    error,
    start,
    stop,
  };
}
