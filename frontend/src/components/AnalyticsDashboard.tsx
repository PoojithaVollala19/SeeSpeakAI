import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  MessageSquare, 
  FileText, 
  Mic, 
  Headphones, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  RefreshCw, 
  ShieldCheck, 
  TrendingUp, 
  Layers,
  ArrowRight,
  User as UserIcon,
  X
} from 'lucide-react';
import { authFetch } from '../utils/authFetch';
import { useAuth } from '../context/AuthContext';
import { FEATURES } from '../config/features';
import { ThemeToggle } from './ThemeToggle';

interface AnalyticsData {
  success: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
  overview: {
    total_conversations: number;
    total_messages: number;
    total_files: number;
    total_interviews: number;
    total_tickets: number;
  };
  interviews: {
    total_interviews: number;
    completed_interviews: number;
    average_score: number;
    average_duration_seconds: number;
    competency_breakdown: Record<string, number>;
    recent: Array<{
      id: string;
      role: string;
      language: string;
      status: string;
      duration_seconds: number;
      overall_score: number;
      created_at: string;
    }>;
  };
  support: {
    total_tickets: number;
    open_tickets: number;
    resolved_tickets: number;
    recent: Array<{
      id: string;
      ticket_number: string;
      subject: string;
      category: string;
      priority: string;
      status: string;
      created_at: string;
    }>;
  };
  feature_distribution: Array<{
    feature_id: string;
    count: number;
  }>;
  recent_activity: Array<{
    id: string;
    title: string;
    feature: string;
    timestamp: string;
  }>;
}

interface AnalyticsDashboardProps {
  onClose?: () => void;
  onNavigate?: (route: string) => void;
  isModal?: boolean;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  onClose,
  onNavigate,
  isModal = false,
}) => {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/analytics');
      if (!res.ok) {
        throw new Error('Failed to load user analytics.');
      }
      const json: AnalyticsData = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('[Analytics] Error loading analytics:', err);
      setError(err.message || 'Unable to load analytics.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const getFeatureTitle = (id: string) => {
    const feat = FEATURES.find((f) => f.id === id);
    return feat ? feat.title : id;
  };

  const totalModuleActivity = data
    ? data.feature_distribution.reduce((acc, curr) => acc + curr.count, 0)
    : 0;

  return (
    <div className={`w-full ${isModal ? 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto animate-fadeIn' : 'relative py-6 max-w-6xl mx-auto px-4'}`}>
      <div className={`w-full max-w-5xl bg-white dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col gap-6 text-slate-900 dark:text-slate-100 transition-colors duration-200 ${isModal ? 'max-h-[92vh] overflow-y-auto' : ''}`}>
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <BarChart3 size={20} />
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Personal Activity & Analytics
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-mono">
                  Isolated Account
                </span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Real-time metrics strictly scoped to account: <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.name}</span> ({user?.email})
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <ThemeToggle size="sm" />
            <button
              onClick={fetchAnalytics}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Analytics"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading && !data && (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            <span className="text-sm font-medium">Computing your isolated analytics...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchAnalytics} className="underline text-xs hover:text-rose-800 dark:hover:text-rose-200 cursor-pointer">Try Again</button>
          </div>
        )}

        {data && (
          <>
            {/* Overview KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Conversations</span>
                  <MessageSquare size={16} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {data.overview.total_conversations}
                </div>
                <span className="text-[11px] text-slate-500 mt-1">Across 6 workspaces</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Messages Sent</span>
                  <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {data.overview.total_messages}
                </div>
                <span className="text-[11px] text-slate-500 mt-1">Multimodal turns</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Uploaded Files</span>
                  <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {data.overview.total_files}
                </div>
                <span className="text-[11px] text-slate-500 mt-1">PDFs, images, media</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Interview Avg</span>
                  <Mic size={16} className="text-rose-600 dark:text-rose-400" />
                </div>
                <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-300 font-mono">
                  {data.interviews.average_score > 0 ? `${data.interviews.average_score}%` : 'N/A'}
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  {data.interviews.completed_interviews} completed
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Support Tickets</span>
                  <Headphones size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-300 font-mono">
                  {data.support.total_tickets}
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  {data.support.resolved_tickets} resolved
                </span>
              </div>
            </div>

            {/* Split Section: Workspace Distribution & Interview Skills */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Module Usage Breakdown */}
              <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
                      Activity by AI Workspace
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      {totalModuleActivity} Total Sessions
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {data.feature_distribution.map((item) => {
                      const pct = totalModuleActivity > 0 ? Math.round((item.count / totalModuleActivity) * 100) : 0;
                      return (
                        <div key={item.feature_id} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-800 dark:text-slate-300 font-medium">{getFeatureTitle(item.feature_id)}</span>
                            <span className="font-mono text-slate-500 dark:text-slate-400">{item.count} ({pct}%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                              style={{ width: `${Math.max(item.count > 0 ? 5 : 0, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {onNavigate && (
                  <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800/60 flex justify-end">
                    <button
                      onClick={() => onNavigate('/app')}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Explore all workspaces</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Interview Competency Radar & Scores */}
              <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp size={16} className="text-rose-600 dark:text-rose-400" />
                      Interview Performance Breakdown
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      {data.interviews.total_interviews} Sessions
                    </span>
                  </div>

                  {data.interviews.completed_interviews === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                      <Mic size={24} className="text-slate-400 dark:text-slate-600" />
                      <span>No completed interviews yet. Practice mock interviews to view real score analytics.</span>
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('/ai-interview')}
                          className="mt-2 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-100 dark:hover:bg-rose-600/30 text-rose-700 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-500/30 transition-colors cursor-pointer"
                        >
                          Start Mock Interview
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3.5">
                      {Object.entries(data.interviews.competency_breakdown).map(([key, val]) => {
                        const label = key.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                        return (
                          <div key={key} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-800 dark:text-slate-300 font-medium">{label}</span>
                              <span className="font-mono text-rose-600 dark:text-rose-300 font-bold">{val}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500"
                                style={{ width: `${val}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Avg Duration: <strong className="text-slate-800 dark:text-slate-200">{Math.round(data.interviews.average_duration_seconds / 60)} mins</strong></span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={14} />
                    <span>Private Evaluation</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Account Activity Feed */}
            <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Clock size={16} className="text-amber-500 dark:text-amber-400" />
                Recent User Conversations & Activity
              </h3>

              {data.recent_activity.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  No activity recorded for this user yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {data.recent_activity.map((act) => (
                    <div
                      key={act.id}
                      onClick={() => onNavigate && onNavigate(`/${act.feature}/c/${act.id}`)}
                      className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0" />
                        <span className="text-xs text-slate-800 dark:text-slate-200 font-medium truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                          {act.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700/60 shrink-0">
                          {getFeatureTitle(act.feature)}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono shrink-0">
                        {new Date(act.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zero-Leakage Privacy Banner */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>
                  <strong>Strict Per-User Isolation Enforced:</strong> These analytics are computed exclusively using your authenticated identity (<code className="text-indigo-700 dark:text-indigo-300 font-mono">{user?.id}</code>).
                </span>
              </div>
              <span className="text-slate-500 font-mono shrink-0">Zero Shared State</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
