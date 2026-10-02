import React from 'react';
import { FEATURES } from '../config/features';
import { getLanguageInfo } from '../config/languages';
import { ThemeToggle } from '../components/ThemeToggle';
import { 
  FileText, 
  Image as ImageIcon, 
  Mic, 
  Headphones, 
  Video, 
  BarChart3, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  Compass,
  LogOut
} from 'lucide-react';
import { SupportedLanguage, User } from '../types';

interface HomePageProps {
  onNavigate: (route: string) => void;
  selectedLanguage: SupportedLanguage;
  onSelectPrompt: (prompt: string, featureId: string) => void;
  onShowIntro?: () => void;
  onOpenAnalytics?: () => void;
  user?: User | null;
  onLogout?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  selectedLanguage,
  onSelectPrompt,
  onShowIntro,
  onOpenAnalytics,
  user,
  onLogout,
}) => {
  const langInfo = getLanguageInfo(selectedLanguage);

  const getFeatureIcon = (id: string) => {
    switch (id) {
      case 'document-analysis':
        return <FileText size={22} className="text-blue-400" />;
      case 'visual-intelligence':
        return <ImageIcon size={22} className="text-purple-400" />;
      case 'ai-interview':
        return <Mic size={22} className="text-rose-400" />;
      case 'customer-support':
        return <Headphones size={22} className="text-emerald-400" />;
      case 'video-audio-review':
        return <Video size={22} className="text-amber-400" />;
      case 'data-study':
      default:
        return <BarChart3 size={22} className="text-indigo-400" />;
    }
  };

  const samplePrompts = [
    { text: 'Explain how modern multimodal AI models work', featureId: 'data-study', langHint: '💡 Concept' },
    { text: 'Analyze this Operating Systems PDF in Telugu', featureId: 'document-analysis', langHint: '🇮🇳 Telugu' },
    { text: 'Practice software engineer mock interview', featureId: 'ai-interview', langHint: '🎤 Live Voice' },
    { text: 'Debug error screenshot and show the code fix', featureId: 'visual-intelligence', langHint: '💻 Vision' },
    { text: 'Contact customer service about my subscription', featureId: 'customer-support', langHint: '🎧 Support' },
    { text: 'Summarize meeting audio notes in Marathi', featureId: 'video-audio-review', langHint: '🇮🇳 Marathi' },
  ];

  return (
    <div className="relative min-h-full flex-1 flex flex-col justify-between max-w-6xl mx-auto px-4 py-8 md:py-12 select-none animate-fadeIn overflow-y-auto">
      {/* Background Depth Lights */}
      <div className="absolute top-10 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Banner Tag & Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full mb-8 gap-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 shadow-sm w-fit">
          <Sparkles size={13} className="text-indigo-600 dark:text-indigo-400" />
          <span>Multimodal AI Workspace</span>
          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600" />
          <span className="text-slate-500 dark:text-slate-400">{langInfo.name}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {user && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 shadow-sm">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold uppercase">
                {user.name[0]}
              </div>
              <span className="font-medium text-slate-800 dark:text-slate-200">{user.name}</span>
            </div>
          )}

          {/* Global Theme Toggle */}
          <ThemeToggle size="sm" />

          {onOpenAnalytics && (
            <button
              onClick={onOpenAnalytics}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 border border-indigo-200 dark:border-indigo-500/30 text-xs text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-white transition-colors cursor-pointer shadow-sm"
              title="View Personal Analytics"
            >
              <BarChart3 size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>Analytics</span>
            </button>
          )}
          {onShowIntro && (
            <button
              onClick={onShowIntro}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shadow-sm"
              title="View Intro Landing Page"
            >
              <Compass size={14} />
              <span>Intro</span>
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-800/60 text-xs text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors cursor-pointer shadow-sm"
              title="Sign Out"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-3">
          Specialized AI Workspaces
        </h1>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto font-light leading-relaxed">
          Select a dedicated module below. Each workspace maintains its own isolated conversation, file context, and specialized reasoning model.
        </p>
      </div>

      {/* Specialized AI Workspaces */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5 w-full mb-12">
        {FEATURES.map((feature) => (
          <button
            key={feature.id}
            onClick={() => onNavigate(feature.route)}
            className={`relative p-5 rounded-2xl bg-white/90 dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 backdrop-blur-md transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl dark:hover:shadow-2xl group flex flex-col justify-between text-left cursor-pointer overflow-hidden shadow-sm dark:shadow-black/50`}
          >
            {/* Top Row: Icon + Arrow */}
            <div>
              <div className="flex items-start justify-between mb-4 w-full">
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-inner group-hover:scale-110 transition-transform">
                  {getFeatureIcon(feature.id)}
                </div>
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/40 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all">
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* Title & Tagline */}
              <h3 className="font-bold text-slate-900 dark:text-white text-base md:text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                {feature.title}
              </h3>
              <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400/80 mb-2">
                {feature.tagline}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {feature.description}
              </p>
            </div>

            {/* Bottom Status / Enter Badge */}
            <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Isolated Workspace
              </span>
              <span className="text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform font-mono">
                Launch →
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Suggested Quick Starters */}
      <div className="w-full max-w-3xl mx-auto text-left">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-amber-500 dark:text-amber-400" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Quick Prompts
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => onSelectPrompt(p.text, p.featureId)}
              className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm cursor-pointer"
            >
              <span>{p.text}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {p.langHint}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
