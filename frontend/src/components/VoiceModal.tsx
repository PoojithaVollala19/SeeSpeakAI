import React, { useEffect } from 'react';
import { VoiceOrb } from './VoiceOrb';
import { TranscriptPanel } from './TranscriptPanel';
import { LatencyBadge } from './LatencyBadge';
import { useVoiceSession } from '../hooks/useVoiceSession';
import { SupportedLanguage } from '../types';
import { X, Mic, Square, AlertTriangle, Sparkles, Hand } from 'lucide-react';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureId: string;
  featureTitle: string;
  conversationId?: string;
  selectedLanguage: SupportedLanguage;
  onVoiceTranscriptFinal?: (userText: string, agentText: string) => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  featureId,
  featureTitle,
  conversationId,
  selectedLanguage,
}) => {
  const {
    voiceState,
    latencyMs,
    voiceMode,
    transcripts,
    audioLevel,
    errorMessage,
    isConnected,
    isRecording,
    startSession,
    stopSession,
  } = useVoiceSession({
    mode: featureId,
    conversationId: conversationId,
    language: selectedLanguage,
  });

  // Automatically start voice session on modal opening
  useEffect(() => {
    if (isOpen && voiceState === 'idle') {
      startSession();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isActive = voiceState !== 'idle' && voiceState !== 'error';

  const handleClose = () => {
    if (isActive) {
      stopSession();
    }
    onClose();
  };

  const getSpokenPromptsForFeature = (featId: string) => {
    switch (featId.toLowerCase()) {
      case 'visualization':
      case 'visual-intelligence':
        return [
          'Explain this visual/chart',
          'What are the key trends?',
          'Highlight any anomalies',
          'Summarize the visual data',
        ];
      case 'video-audio-review':
      case 'audio-video-review':
        return [
          'Summarize this recording',
          'What were the key takeaways?',
          'Highlight key timestamps',
          'Explain the speaker’s main points',
        ];
      case 'customer-support':
      case 'customer-service':
        return [
          'Help me resolve my issue',
          'Check the status of my request',
          'Provide troubleshooting steps',
          'Explain our service policy',
        ];
      case 'document-analysis':
      default:
        return [
          'Explain this for my exam',
          'Make short revision notes',
          'Summarize this document',
          'Explain the main concept',
        ];
    }
  };

  const spokenPrompts = getSpokenPromptsForFeature(featureId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center overflow-hidden transition-colors duration-200">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-[100px] pointer-events-none" />

        {/* Top Header */}
        <div className="w-full flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800/80 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles size={14} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{featureTitle} Voice Agent</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Grounded Real-Time Speech • {selectedLanguage.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LatencyBadge latencyMs={latencyMs} isConnected={isConnected} voiceMode={voiceMode} />
            <button
              onClick={handleClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close voice modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Central Voice Orb with Real RMS Audio Reactive Physics */}
        <div className="my-5 flex flex-col items-center relative z-10">
          <VoiceOrb
            state={voiceState}
            audioLevel={audioLevel}
            onClick={isActive ? stopSession : () => { startSession(); }}
          />

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={isActive ? stopSession : () => { startSession(); }}
              className={`px-6 py-2.5 rounded-full font-semibold text-xs tracking-wide transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 active:scale-95'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95'
              }`}
            >
              {isActive ? (
                <>
                  <Square size={14} /> Stop Voice
                </>
              ) : (
                <>
                  <Mic size={14} /> Start Voice
                </>
              )}
            </button>

            {voiceState === 'speaking' && (
              <button
                onClick={() => {
                  // User clicks interrupt or speaks
                  stopSession();
                  startSession();
                }}
                className="px-4 py-2.5 rounded-full font-semibold text-xs tracking-wide bg-amber-600 hover:bg-amber-500 text-white shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Interrupt AI speaking"
              >
                <Hand size={13} />
                <span>Interrupt (Barge-in)</span>
              </button>
            )}
          </div>
        </div>

        {/* Spoken Quick Prompt Suggestions */}
        <div className="w-full flex items-center justify-center gap-1.5 mb-3 flex-wrap relative z-10">
          <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-slate-500 mr-1">Try saying:</span>
          {spokenPrompts.map((prompt, idx) => (
            <span
              key={idx}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300"
            >
              "{prompt}"
            </span>
          ))}
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="w-full my-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs flex items-center gap-2 relative z-10">
            <AlertTriangle size={15} className="text-red-500 dark:text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Real-Time Live Transcript Area */}
        <div className="w-full mt-1 relative z-10">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Live Speech Transcript</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Gemini Live Bidirectional</span>
          </div>
          <TranscriptPanel
            transcripts={transcripts}
            emptyMessage="Speak naturally into your microphone. The AI answers aloud in real time using your attached files & conversation context."
          />
        </div>
      </div>
    </div>
  );
};
