import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Ticket,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  FileText,
  Copy,
  Check,
  Download,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ArrowRight
} from 'lucide-react';
import { SupportedLanguage, TranscriptTurn } from '../types';

export interface SupportSummaryData {
  session_status: string;
  issue_summary: string;
  ai_understanding: string;
  resolution_provided: string;
  ticket_created: boolean;
  ticket_id?: string;
  raw_ticket_id?: string;
  ticket_status?: string;
  priority?: string;
  category?: string;
  conversation_summary: string;
  recommended_next_steps: string[];
  full_transcript: TranscriptTurn[];
  duration_seconds: number;
}

interface SupportResultDashboardProps {
  summaryData: SupportSummaryData;
  language: SupportedLanguage;
  onRestart: () => void;
}

export const SupportResultDashboard: React.FC<SupportResultDashboardProps> = ({
  summaryData,
  language,
  onRestart,
}) => {
  const [copied, setCopied] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleCopySummary = () => {
    const text = `
=== SUPPORT SESSION SUMMARY ===
Status: ${summaryData.session_status}
Duration: ${formatDuration(summaryData.duration_seconds)}
Issue: ${summaryData.issue_summary}
AI Resolution: ${summaryData.resolution_provided}
Ticket ID: ${summaryData.ticket_id || 'N/A'} (Status: ${summaryData.ticket_status || 'Open'})
Summary: ${summaryData.conversation_summary}

Next Steps:
${summaryData.recommended_next_steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportTranscript = () => {
    const text = summaryData.full_transcript
      .map((t) => `[${t.speaker.toUpperCase()}]: ${t.text}`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Support_Session_${summaryData.ticket_id || 'Summary'}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full space-y-6">
      {/* Top Banner Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-50 via-white to-indigo-50 dark:from-emerald-950/60 dark:via-slate-900 dark:to-indigo-950/40 border border-emerald-200 dark:border-emerald-500/30 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-inner">
              <ShieldCheck size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  {summaryData.session_status}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                  <Clock size={12} /> {formatDuration(summaryData.duration_seconds)}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                Support Session Complete
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Session inquiry resolved and logged to customer service history.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleCopySummary}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-sm"
            >
              {copied ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy Summary'}</span>
            </button>
            <button
              onClick={onRestart}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>New Session</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Context Badge / Card */}
      {summaryData.ticket_id && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Ticket size={20} />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Associated Support Ticket</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{summaryData.ticket_id}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-normal">
                  {summaryData.ticket_status || 'Open'}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-normal">
                  Priority: {summaryData.priority || 'Medium'}
                </span>
              </div>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {summaryData.category || 'Technical Support'}
          </span>
        </div>
      )}

      {/* Grid: Issue Summary & AI Resolution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Issue Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono">
            <AlertCircle size={15} className="text-amber-500 dark:text-amber-400" />
            <span>Customer Reported Issue</span>
          </h3>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
            {summaryData.issue_summary}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
            <strong className="text-slate-800 dark:text-slate-300">AI Understanding:</strong> {summaryData.ai_understanding}
          </div>
        </div>

        {/* Resolution Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono">
            <CheckCircle2 size={15} className="text-emerald-500 dark:text-emerald-400" />
            <span>AI Resolution & Troubleshooting</span>
          </h3>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
            {summaryData.resolution_provided}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
            <strong className="text-slate-800 dark:text-slate-300">Conversation Summary:</strong> {summaryData.conversation_summary}
          </div>
        </div>
      </div>

      {/* Recommended Next Steps */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono">
          <ArrowRight size={15} className="text-indigo-600 dark:text-indigo-400" />
          <span>Recommended Next Steps</span>
        </h3>
        <ul className="space-y-2">
          {summaryData.recommended_next_steps.map((step, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/60"
            >
              <span className="w-5 h-5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Transcript Accordion */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono">
            <MessageSquare size={15} className="text-indigo-600 dark:text-indigo-400" />
            <span>Session Transcript ({summaryData.full_transcript.length} turns)</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportTranscript}
              className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <Download size={13} />
              <span>Export</span>
            </button>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <button
              onClick={() => setShowFullTranscript(!showFullTranscript)}
              className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold cursor-pointer"
            >
              <span>{showFullTranscript ? 'Collapse' : 'Expand'}</span>
              {showFullTranscript ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {showFullTranscript && (
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 max-h-96 overflow-y-auto pr-1">
            {summaryData.full_transcript.map((turn, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl text-xs leading-relaxed ${
                  turn.speaker === 'user'
                    ? 'bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-950 dark:text-slate-200 ml-6'
                    : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 mr-6'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  {turn.speaker === 'user' ? 'Customer' : 'AI Support Agent'}
                </div>
                <div>{turn.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
