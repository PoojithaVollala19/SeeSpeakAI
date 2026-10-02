import React, { useState } from 'react';
import {
  Award,
  Clock,
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Download,
  Copy,
  Check,
  RefreshCw,
  Video,
  Monitor,
  Mic,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { InterviewSessionData, SupportedLanguage } from '../types';
import { useTranslation } from '../locales/i18n';

interface InterviewResultDashboardProps {
  sessionData: InterviewSessionData;
  language: SupportedLanguage;
  onRestart: () => void;
}

export const InterviewResultDashboard: React.FC<InterviewResultDashboardProps> = ({
  sessionData,
  language,
  onRestart,
}) => {
  const { t } = useTranslation(language);
  const [copied, setCopied] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [expandedQuestionIdx, setExpandedQuestionIdx] = useState<number | null>(0);

  const rawEval = (sessionData.evaluation || {}) as Record<string, any>;
  const hasEvaluation = typeof rawEval === 'object' && Object.keys(rawEval).length > 0 && rawEval.overall_score !== undefined;

  const evalData = {
    overall_score: hasEvaluation ? Number(rawEval.overall_score) || 0 : 0,
    evaluation_method: (rawEval.evaluation_method as string) || "Rubric-based assessment of communication, clarity, and relevance.",
    feedback: (rawEval.feedback as string) || "",
    performance_metrics: (rawEval.performance_metrics || rawEval.scores || {
      communication: 0,
      clarity: 0,
      relevance: 0,
      technical_knowledge: 0,
      problem_solving: 0,
      completeness: 0,
      consistency: 0,
      engagement: 0,
    }) as Record<string, number>,
    strengths: Array.isArray(rawEval.strengths) ? (rawEval.strengths as string[]) : [],
    areas_for_improvement: Array.isArray(rawEval.areas_for_improvement) ? (rawEval.areas_for_improvement as string[]) : [],
    recommendations: Array.isArray(rawEval.recommendations) ? (rawEval.recommendations as string[]) : [],
    question_analysis: Array.isArray(rawEval.question_analysis) ? rawEval.question_analysis : []
  };

  const metrics = sessionData.experience_metrics || {
    interruptions: 0,
    duration_seconds: sessionData.duration_seconds || 0,
    camera_used: false,
    screen_share_used: false,
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleCopyTranscript = () => {
    const text = (sessionData.transcript || [])
      .map((t) => `[${t.speaker.toUpperCase()} - ${new Date(t.timestamp).toLocaleTimeString()}]: ${t.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    const reportText = `======================================================
SEESPEAK AI - INTERVIEW ASSESSMENT REPORT
======================================================
Role / Type: ${sessionData.interview_type}
Date: ${new Date(sessionData.created_at).toLocaleString()}
Language: ${sessionData.language.toUpperCase()}
Duration: ${formatDuration(sessionData.duration_seconds || 0)}
Overall Performance Score: ${evalData.overall_score}/100

EVALUATION METHODOLOGY:
${evalData.evaluation_method}

PERFORMANCE BREAKDOWN:
- Communication: ${evalData.performance_metrics.communication}/100
- Clarity: ${evalData.performance_metrics.clarity}/100
- Relevance: ${evalData.performance_metrics.relevance}/100
- Technical Knowledge: ${evalData.performance_metrics.technical_knowledge}/100
- Problem Solving: ${evalData.performance_metrics.problem_solving}/100
- Completeness: ${evalData.performance_metrics.completeness}/100
- Consistency: ${evalData.performance_metrics.consistency}/100
- Engagement: ${evalData.performance_metrics.engagement}/100

OBSERVED STRENGTHS:
${evalData.strengths.map((s) => `* ${s}`).join('\n')}

AREAS FOR IMPROVEMENT:
${evalData.areas_for_improvement.map((a) => `* ${a}`).join('\n')}

RECOMMENDATIONS:
${evalData.recommendations.map((r) => `* ${r}`).join('\n')}

EXPERIENCE & TELEMETRY:
- Camera Used: ${metrics.camera_used ? 'Yes' : 'No'}
- Screen Shared: ${metrics.screen_share_used ? 'Yes' : 'No'}
- Interruptions / Barge-ins: ${metrics.interruptions}
- Duration: ${formatDuration(metrics.duration_seconds)}

======================================================
FULL CONVERSATION TRANSCRIPT:
======================================================
${(sessionData.transcript || []).map((t) => `[${t.speaker.toUpperCase()}]: ${t.text}`).join('\n\n')}
`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Interview_Report_${sessionData.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10';
    if (score >= 70) return 'text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10';
    return 'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10';
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 max-w-5xl mx-auto w-full space-y-8 animate-fadeIn transition-colors duration-200">
      {/* Top Banner */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-indigo-50 dark:from-indigo-950/60 via-white dark:via-slate-900 to-slate-100 dark:to-slate-950 border border-indigo-200 dark:border-indigo-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 transition-colors duration-200">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider">
            <CheckCircle2 size={14} />
            <span>{t('interview.complete_title', 'Interview Completed')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {sessionData.interview_type}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
            {t('interview.subtitle', 'Real-time conversational mock interview')} &bull; {new Date(sessionData.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Big Overall Score Circle */}
        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-500/40 shadow-xl shrink-0 text-center min-w-[140px]">
          <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
            {t('interview.overall_score', 'Overall Score')}
          </span>
          <span className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 dark:from-indigo-400 via-purple-500 dark:via-purple-300 to-rose-500 dark:to-rose-400">
            {evalData.overall_score}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">out of 100</span>
        </div>
      </div>

      {/* Dynamic Executive Feedback Summary */}
      {evalData.feedback && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-indigo-200 dark:border-indigo-500/30 text-slate-700 dark:text-slate-200 text-sm leading-relaxed shadow-lg">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
            Executive Performance Summary
          </span>
          <p>{evalData.feedback}</p>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('interview.duration', 'Duration')}</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">{formatDuration(sessionData.duration_seconds || 0)}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <HelpCircle size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('interview.questions_count', 'Questions')}</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">{(sessionData.questions || []).length || (evalData.question_analysis || []).length || (sessionData.transcript || []).filter(t => t.speaker === 'ai').length || 0}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <MessageSquare size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('interview.responses_count', 'Answers')}</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">{(sessionData.answers || []).length || (evalData.question_analysis || []).filter(q => q.answer && !q.evaluation?.toLowerCase().includes('skipped')).length || (sessionData.transcript || []).filter(t => t.speaker === 'user').length || 0}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Award size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Language</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white uppercase">{sessionData.language}</div>
          </div>
        </div>
      </div>

      {/* Performance Overview (8-metric rubric) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-indigo-600 dark:text-indigo-400" />
              <span>{t('interview.performance_overview', 'Performance Overview')}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Multidimensional evaluation derived across key communication and problem-solving pillars
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {Object.entries(evalData.performance_metrics).map(([key, rawScore]) => {
            const score = typeof rawScore === 'number' ? rawScore : Number(rawScore) || 0;
            return (
              <div key={key} className={`p-3.5 rounded-2xl border ${getScoreColor(score)} flex flex-col justify-between`}>
                <span className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-300">
                  {key.replace(/_/g, ' ')}
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold">{score}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">/ 100</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-current h-full rounded-full transition-all duration-700"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {evalData.evaluation_method && (
          <p className="text-[11px] text-slate-500 italic mt-2">
            &bull; {evalData.evaluation_method}
          </p>
        )}
      </div>

      {/* Strengths & Areas for Improvement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="p-6 rounded-3xl bg-emerald-50/60 dark:bg-slate-900/70 border border-emerald-200 dark:border-emerald-500/20 shadow-xl space-y-3">
          <h3 className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{t('interview.strengths', 'Observed Strengths')}</span>
          </h3>
          <ul className="space-y-2.5">
            {evalData.strengths.map((str, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mt-1.5 shrink-0" />
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Areas for Improvement */}
        <div className="p-6 rounded-3xl bg-amber-50/60 dark:bg-slate-900/70 border border-amber-200 dark:border-amber-500/20 shadow-xl space-y-3">
          <h3 className="text-base font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{t('interview.improvements', 'Areas for Improvement')}</span>
          </h3>
          <ul className="space-y-2.5">
            {evalData.areas_for_improvement.map((area, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 mt-1.5 shrink-0" />
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Concrete Practice Recommendations */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-100/70 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900/70 border border-indigo-200 dark:border-indigo-500/20 shadow-xl space-y-3">
        <h3 className="text-base font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
          <Lightbulb size={18} className="text-indigo-600 dark:text-indigo-400" />
          <span>{t('interview.recommendations', 'Concrete Practice Recommendations')}</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {evalData.recommendations.map((rec, idx) => (
            <div key={idx} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed shadow-sm">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 block mb-1">Step {idx + 1}</span>
              {rec}
            </div>
          ))}
        </div>
      </div>

      {/* Question-by-Question Analysis */}
      {evalData.question_analysis && evalData.question_analysis.length > 0 && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText size={18} className="text-purple-600 dark:text-purple-400" />
            <span>{t('interview.question_analysis', 'Question-by-Question Analysis')}</span>
          </h3>

          <div className="space-y-3">
            {evalData.question_analysis.map((qa, idx) => {
              const isExpanded = expandedQuestionIdx === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setExpandedQuestionIdx(isExpanded ? null : idx)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-900/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 pr-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 dark:border-indigo-500/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                        {qa.question}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {qa.score && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {qa.score}/100
                        </span>
                      )}
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 pt-0 border-t border-slate-200 dark:border-slate-800/60 space-y-3 text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">Your Spoken Answer:</span>
                        <p className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 italic leading-relaxed">
                          "{qa.answer}"
                        </p>
                      </div>

                      <div>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold block mb-1">AI Evaluation:</span>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{qa.evaluation}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {qa.strengths && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                            <span className="font-semibold block mb-0.5">Strength:</span>
                            {qa.strengths}
                          </div>
                        )}
                        {qa.improvements && (
                          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300">
                            <span className="font-semibold block mb-0.5">Tip for Next Time:</span>
                            {qa.improvements}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Experience & Telemetry */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>{t('interview.user_experience', 'Interview Experience & Telemetry')}</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block mb-1">Camera Usage</span>
            <div className="flex items-center gap-2 font-semibold">
              <Video size={16} className={metrics.camera_used ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400'} />
              <span>{metrics.camera_used ? 'Enabled' : 'Audio-Only'}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block mb-1">Screen Sharing</span>
            <div className="flex items-center gap-2 font-semibold">
              <Monitor size={16} className={metrics.screen_share_used ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'} />
              <span>{metrics.screen_share_used ? 'Active' : 'None'}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block mb-1">Interruptions</span>
            <div className="flex items-center gap-2 font-semibold">
              <Mic size={16} className="text-rose-500 dark:text-rose-400" />
              <span>{metrics.interruptions} barge-in turns</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block mb-1">Spoken Language</span>
            <div className="font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {sessionData.language}
            </div>
          </div>
        </div>
      </div>

      {/* Full Transcript Collapsible */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare size={18} className="text-indigo-600 dark:text-indigo-400" />
            <span>{t('interview.view_transcript', 'Full Transcript')}</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTranscript}
              className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-500 dark:text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? t('interview.copied', 'Copied!') : t('interview.copy_transcript', 'Copy')}</span>
            </button>
            <button
              onClick={() => setShowFullTranscript(!showFullTranscript)}
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            >
              {showFullTranscript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {showFullTranscript && (
          <div className="max-h-96 overflow-y-auto space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs leading-relaxed">
            {(sessionData.transcript || []).length === 0 ? (
              <p className="text-slate-500 italic">No dialogue recorded in this session.</p>
            ) : (
              (sessionData.transcript || []).map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border ${
                    t.speaker === 'user'
                      ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-500/30 text-indigo-900 dark:text-indigo-200 ml-6'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 mr-6'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider mb-1 text-slate-500 dark:text-slate-400">
                    <span>{t.speaker === 'user' ? 'Candidate (You)' : 'AI Interviewer'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                      {t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <p>{t.text}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Dock */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 pb-12">
        <button
          onClick={handleDownloadReport}
          className="px-6 py-3 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white font-semibold text-sm shadow-xl flex items-center gap-2 transition-all cursor-pointer"
        >
          <Download size={16} />
          <span>{t('interview.download_report', 'Download Report')}</span>
        </button>

        <button
          onClick={onRestart}
          className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
        >
          <RefreshCw size={16} />
          <span>{t('interview.practice_again', 'Practice Another Interview')}</span>
        </button>
      </div>
    </div>
  );
};
