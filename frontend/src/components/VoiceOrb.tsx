import React from 'react';
import { VoiceState } from '../types';

interface VoiceOrbProps {
  state: VoiceState;
  audioLevel: number; // 0 to 1
  onClick?: () => void;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, audioLevel, onClick }) => {
  // Compute scale based on audio level
  const scale = 1 + Math.min(0.35, audioLevel * 0.4);

  const getOrbGradient = () => {
    switch (state) {
      case 'ai_speaking':
      case 'speaking':
        return 'from-cyan-400 via-indigo-500 to-purple-600 shadow-indigo-500/50';
      case 'waiting_for_candidate':
        return 'from-teal-400 via-emerald-500 to-cyan-600 shadow-teal-500/50 animate-pulse';
      case 'candidate_speaking':
      case 'listening':
        return 'from-emerald-400 via-teal-500 to-cyan-600 shadow-emerald-500/50';
      case 'processing_answer':
        return 'from-purple-500 via-indigo-500 to-sky-500 shadow-purple-500/50 animate-pulse';
      case 'connecting':
        return 'from-amber-400 via-orange-500 to-rose-500 shadow-amber-500/50 animate-pulse';
      case 'interrupted':
        return 'from-rose-500 via-pink-600 to-purple-600 shadow-rose-500/50';
      case 'error':
        return 'from-red-600 via-rose-600 to-pink-700 shadow-red-500/50';
      case 'ending':
      case 'ended':
      case 'idle':
      default:
        return 'from-slate-600 via-slate-700 to-slate-800 shadow-slate-700/30';
    }
  };

  const getStatusLabel = () => {
    switch (state) {
      case 'connecting':
        return 'Connecting...';
      case 'ai_speaking':
      case 'speaking':
        return 'Interviewer is speaking...';
      case 'waiting_for_candidate':
      case 'candidate_speaking':
      case 'listening':
        return 'Listening...';
      case 'processing_answer':
        return 'Thinking...';
      case 'interrupted':
        return 'Interrupted';
      case 'error':
        return 'Connection error';
      case 'ending':
        return 'Ending interview...';
      case 'ended':
        return 'Interview ended';
      case 'idle':
      default:
        return 'Start Voice';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 select-none">
      <div className="relative flex items-center justify-center">
        {/* Ambient Ring 1 */}
        {state !== 'idle' && (
          <div
            className={`absolute w-48 h-48 md:w-56 md:h-56 rounded-full opacity-20 blur-xl transition-all duration-300 ${
              state === 'speaking' ? 'bg-indigo-500' : 'bg-teal-500'
            }`}
            style={{ transform: `scale(${scale * 1.25})` }}
          />
        )}

        {/* Ambient Ring 2 */}
        {state !== 'idle' && (
          <div
            className="absolute w-40 h-40 md:w-44 md:h-44 rounded-full border border-indigo-400/30 animate-ping opacity-40"
            style={{ animationDuration: state === 'speaking' ? '1.5s' : '2.5s' }}
          />
        )}

        {/* Core Animated Orb */}
        <button
          onClick={onClick}
          aria-label={getStatusLabel()}
          className={`relative w-32 h-32 md:w-36 md:h-36 rounded-full bg-gradient-to-tr ${getOrbGradient()} shadow-2xl flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-95 group focus:outline-none`}
          style={{ transform: `scale(${scale})` }}
        >
          {/* Inner Gloss */}
          <div className="absolute top-2 left-3 w-12 h-6 rounded-full bg-white/20 blur-[1px] transform -rotate-45" />

          {/* Center Graphic */}
          <div className="flex items-center gap-1">
            <span
              className={`w-1 rounded-full bg-white/80 transition-all duration-150 ${
                state === 'speaking' || state === 'listening' ? 'h-8 animate-pulse' : 'h-3'
              }`}
            />
            <span
              className={`w-1 rounded-full bg-white/90 transition-all duration-150 ${
                state === 'speaking' || state === 'listening' ? 'h-12 animate-pulse' : 'h-5'
              }`}
              style={{ animationDelay: '150ms' }}
            />
            <span
              className={`w-1 rounded-full bg-white/80 transition-all duration-150 ${
                state === 'speaking' || state === 'listening' ? 'h-8 animate-pulse' : 'h-3'
              }`}
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </button>
      </div>

      {/* Status Label */}
      <div className="mt-6 flex flex-col items-center gap-1">
        <span className="text-sm font-medium tracking-wide text-slate-300">
          {getStatusLabel()}
        </span>
      </div>
    </div>
  );
};
