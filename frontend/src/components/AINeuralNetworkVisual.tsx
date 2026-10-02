import React, { useState } from 'react';
import { FileText, Eye, Mic, Cpu, Sparkles, MessageSquare, Zap } from 'lucide-react';

export const AINeuralNetworkVisual: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [activeNode, setActiveNode] = useState<string | null>(null);

  return (
    <div
      className={`relative p-5 rounded-3xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl backdrop-blur-xl transition-colors duration-300 ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Neural Multimodal Pipeline
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
          <span>Active Ingestion</span>
        </div>
      </div>

      {/* Interactive Visual Network Diagram */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
        {/* Column 1: Modality Inputs */}
        <div className="flex flex-col gap-2">
          <div
            onMouseEnter={() => setActiveNode('doc')}
            onMouseLeave={() => setActiveNode(null)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              activeNode === 'doc'
                ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-500 text-blue-700 dark:text-blue-300 shadow-md shadow-blue-500/20 scale-[1.02]'
                : 'bg-slate-50/90 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium">
              <FileText size={14} className="text-blue-500 dark:text-blue-400" />
              <span>Document &amp; Tables</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">PDF, DOCX, CSV OCR</span>
          </div>

          <div
            onMouseEnter={() => setActiveNode('vision')}
            onMouseLeave={() => setActiveNode(null)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              activeNode === 'vision'
                ? 'bg-purple-50 dark:bg-purple-950/70 border-purple-500 text-purple-700 dark:text-purple-300 shadow-md shadow-purple-500/20 scale-[1.02]'
                : 'bg-slate-50/90 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium">
              <Eye size={14} className="text-purple-500 dark:text-purple-400" />
              <span>Camera &amp; Screen Vision</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Live video frames</span>
          </div>

          <div
            onMouseEnter={() => setActiveNode('audio')}
            onMouseLeave={() => setActiveNode(null)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              activeNode === 'audio'
                ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-500 text-rose-700 dark:text-rose-300 shadow-md shadow-rose-500/20 scale-[1.02]'
                : 'bg-slate-50/90 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium">
              <Mic size={14} className="text-rose-500 dark:text-rose-400" />
              <span>Sub-Second Speech</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">15+ Native scripts</span>
          </div>
        </div>

        {/* Column 2: Central Multimodal Fusion Core */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-indigo-50 via-white to-slate-50 dark:from-indigo-950/40 dark:to-slate-950/80 border border-indigo-200 dark:border-indigo-500/30 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-indigo-500/10 blur-md pointer-events-none" />
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/15 dark:bg-indigo-600/30 border border-indigo-300 dark:border-indigo-400 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mb-2 shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">
            <Sparkles size={20} className="animate-spin text-indigo-600 dark:text-indigo-300" />
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">Gemini Live Core</span>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-300/80 font-mono mt-0.5">Unified Fusion Layer</span>
          <div className="mt-2 w-full flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-ping" />
            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400">~180ms latency</span>
          </div>
        </div>

        {/* Column 3: Synthesized Output & Action */}
        <div className="flex flex-col gap-2">
          <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-300">
              <MessageSquare size={14} className="text-emerald-500 dark:text-emerald-400" />
              <span>Voice &amp; Chat Dialogue</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Instant spoken reply</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-300">
              <Zap size={14} className="text-amber-500 dark:text-amber-400" />
              <span>Real-Time Action</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Tickets, reports &amp; radar</span>
          </div>
        </div>
      </div>
    </div>
  );
};
