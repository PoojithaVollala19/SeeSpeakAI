import React, { useEffect, useRef } from 'react';
import { TranscriptItem } from '../hooks/useVoiceSession';
import { User, Bot } from 'lucide-react';

interface TranscriptPanelProps {
  transcripts: TranscriptItem[];
  emptyMessage?: string;
  isInterviewMode?: boolean;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  transcripts,
  emptyMessage = 'Start speaking. Your live spoken transcripts will appear here in real-time.',
  isInterviewMode = true,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  return (
    <div className="w-full h-72 md:h-80 overflow-y-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 backdrop-blur-sm flex flex-col space-y-3.5 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-800">
      {transcripts.length === 0 ? (
        <div className="h-full flex items-center justify-center text-center text-slate-400 dark:text-slate-500 text-sm italic px-6">
          {emptyMessage}
        </div>
      ) : (
        transcripts.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 text-sm animate-fadeIn ${
              item.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {item.role === 'agent' && (
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 dark:bg-indigo-600/20 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                <Bot size={15} />
              </div>
            )}

            <div
              className={`max-w-[85%] md:max-w-[75%] px-4 py-2.5 rounded-2xl leading-relaxed ${
                item.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 rounded-tl-none shadow-sm'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-75">
                {item.role === 'user'
                  ? (isInterviewMode ? 'CANDIDATE' : 'You')
                  : (isInterviewMode ? 'INTERVIEWER' : 'AI ASSISTANT')}
              </div>
              <p className="whitespace-pre-wrap">{item.text}</p>
              {!item.isFinal && (
                <span className="inline-block w-1.5 h-1.5 ml-1 bg-current rounded-full animate-ping" />
              )}
            </div>

            {item.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0 mt-0.5">
                <User size={15} />
              </div>
            )}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
};
