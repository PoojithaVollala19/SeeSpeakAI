import React from 'react';
import { Zap } from 'lucide-react';

interface LatencyBadgeProps {
  latencyMs: number | null;
  isConnected: boolean;
  voiceMode?: string;
}

export const LatencyBadge: React.FC<LatencyBadgeProps> = ({
  latencyMs,
  isConnected,
  voiceMode = 'gemini',
}) => {
  const isMock = voiceMode === 'mock';

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs shadow-inner">
      {/* Provider State Badge */}
      {isMock ? (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold tracking-wide">
          DEVELOPMENT MOCK MODE
        </span>
      ) : (
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
          />
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-wide">
            LIVE AI
          </span>
        </div>
      )}

      {/* Latency Display */}
      {latencyMs !== null && (
        <>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1 text-indigo-300 font-mono font-medium text-[11px]">
            <Zap size={11} className="text-amber-400" />
            <span>{latencyMs} ms</span>
          </div>
        </>
      )}
    </div>
  );
};
