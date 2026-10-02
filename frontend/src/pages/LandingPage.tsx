import React, { useState, useEffect } from 'react';
import { AIOrb } from '../components/AIOrb';
import { AIChatbotIllustration } from '../components/AIChatbotIllustration';
import { AINeuralNetworkVisual } from '../components/AINeuralNetworkVisual';
import { FEATURES } from '../config/features';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { 
  ArrowRight, 
  Sparkles, 
  Mic, 
  Eye, 
  FileText, 
  BarChart3, 
  Video, 
  Headphones,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Globe2,
  Lock,
  UserPlus,
  LogIn,
  Layers,
  ChevronRight,
  TrendingUp,
  Cpu,
  Activity,
  Award,
  Clock,
  Sparkle,
  Bot,
  MessageSquare,
  Sun,
  Moon
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (route: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { isAuthenticated, user } = useAuth();
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'thinking'>('idle');
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<'overview' | 'radar' | 'modules'>('overview');

  // Global Theme Management
  const { theme, toggleTheme } = useTheme();

  const getFeatureIcon = (id: string) => {
    switch (id) {
      case 'document-analysis':
        return <FileText size={22} className="text-blue-500 dark:text-blue-400" />;
      case 'visual-intelligence':
        return <Eye size={22} className="text-purple-500 dark:text-purple-400" />;
      case 'ai-interview':
        return <Mic size={22} className="text-rose-500 dark:text-rose-400" />;
      case 'customer-support':
        return <Headphones size={22} className="text-emerald-500 dark:text-emerald-400" />;
      case 'video-audio-review':
        return <Video size={22} className="text-amber-500 dark:text-amber-400" />;
      case 'data-study':
      default:
        return <BarChart3 size={22} className="text-indigo-500 dark:text-indigo-400" />;
    }
  };

  return (
    <div className="relative w-full h-screen overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-800 dark:selection:text-indigo-200 scroll-smooth transition-colors duration-300">
      {/* Dynamic Background Gradients & Glow Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-opacity duration-300">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[850px] h-[550px] bg-gradient-to-b from-indigo-500/15 via-purple-500/10 to-transparent dark:from-indigo-600/25 dark:via-purple-600/15 blur-[150px] opacity-75 animate-pulse-glow" />
        <div className="absolute top-[35%] -left-48 w-[450px] h-[450px] bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-[65%] -right-48 w-[450px] h-[450px] bg-purple-500/10 dark:bg-purple-600/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-1/3 w-[500px] h-[350px] bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full blur-[160px]" />
      </div>

      {/* Subtle Blueprint Grid Pattern */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.035] dark:opacity-[0.03] z-0 transition-opacity duration-300"
        style={{
          backgroundImage: theme === 'dark'
            ? `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`
            : `linear-gradient(to right, #000000 1px, transparent 1px), linear-gradient(to bottom, #000000 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/75 border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 py-3.5 transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Brand */}
          <div 
            onClick={() => onNavigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 p-[1.5px] shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-all">
              <div className="w-full h-full rounded-[10px] bg-white dark:bg-slate-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                <Sparkles size={19} />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold tracking-widest text-sm uppercase text-slate-900 dark:text-slate-100 font-mono">
                SeeSpeak AI
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tracking-tight hidden sm:inline">
                Intelligent Multimodal AI Workspace
              </span>
            </div>
          </div>

          {/* Quick Nav Anchors (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-300">
            <a href="#capabilities" className="hover:text-slate-900 dark:hover:text-white transition-colors">Capabilities</a>
            <a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors">How It Works</a>
            <a href="#analytics-preview" className="hover:text-slate-900 dark:hover:text-white transition-colors">Analytics</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Global Light / Dark Mode Toggle Button */}
            <ThemeToggle size="sm" />

            {isAuthenticated ? (
              <button
                onClick={() => onNavigate('/app')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all cursor-pointer active:scale-95 min-h-[40px]"
              >
                <span>Open Workspace ({user?.name.split(' ')[0]})</span>
                <ArrowRight size={15} />
              </button>
            ) : (
              <>
                <button
                  onClick={() => onNavigate('/login')}
                  className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-200 hover:border-slate-300 dark:border-slate-700/80 dark:hover:border-slate-600 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white text-xs sm:text-sm font-medium transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 active:scale-95 min-h-[40px]"
                  aria-label="Sign In to SeeSpeak AI"
                >
                  <LogIn size={15} className="text-slate-500 dark:text-slate-400" />
                  <span>Login</span>
                </button>
                <button
                  onClick={() => onNavigate('/register')}
                  className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 hover:shadow-indigo-600/45 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.96] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[40px]"
                  aria-label="Get Started with SeeSpeak AI"
                >
                  <UserPlus size={15} />
                  <span>Get Started</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10">
        {/* ===================== HERO SECTION ===================== */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 md:pt-16 md:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Hero Column: Headline, Description & Actions */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
              {/* Release / Capability Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm font-medium mb-6 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                <span className="font-mono text-slate-700 dark:text-slate-300">SeeSpeak AI</span>
                <span className="text-slate-400 dark:text-slate-600">•</span>
                <span>Intelligent Multimodal Workspace</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900 dark:text-white max-w-2xl mb-6">
                Where Vision, Voice &amp; Data{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 dark:from-indigo-300 dark:via-white dark:to-purple-300">
                  Transform Into Action
                </span>
              </h1>

              {/* Supporting Text */}
              <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-xl font-light mb-8 leading-relaxed">
                SeeSpeak AI is an intelligent workspace that empowers you to analyze, understand, communicate with, and interact with complex information using cutting-edge multimodal AI.
              </p>

              {/* Primary Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto mb-8">
                {isAuthenticated ? (
                  <button
                    onClick={() => onNavigate('/app')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base shadow-xl shadow-indigo-600/30 border border-indigo-400/20 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer min-h-[48px]"
                  >
                    <span>Open Workspace Dashboard</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onNavigate('/register')}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-base shadow-xl shadow-indigo-600/30 border border-indigo-400/30 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer min-h-[48px]"
                    >
                      <span>Get Started Free</span>
                      <ArrowRight size={18} />
                    </button>
                    <button
                      onClick={() => onNavigate('/login')}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-300 hover:border-slate-400 dark:border-slate-700/80 dark:hover:border-slate-600 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white font-medium text-base shadow-sm transition-all cursor-pointer active:scale-95 min-h-[48px]"
                    >
                      <LogIn size={18} className="text-slate-500 dark:text-slate-400" />
                      <span>Login</span>
                    </button>
                  </>
                )}
              </div>

              {/* Value Badges Strip under buttons on Left */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-slate-600 dark:text-slate-400 font-mono">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-emerald-500 dark:text-emerald-400" />
                  <span>Strict Isolation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap size={15} className="text-amber-500 dark:text-amber-400" />
                  <span>Sub-Second Latency</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe2 size={15} className="text-blue-500 dark:text-blue-400" />
                  <span>15+ Indian Languages</span>
                </div>
              </div>
            </div>

            {/* Right Hero Column: Enlarged Prominent AI Bot Focal Visual */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center relative py-6">
              {/* Ambient Radiant Glow Behind the Bot */}
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/15 via-purple-500/10 to-transparent dark:from-indigo-500/25 dark:via-purple-500/15 rounded-full blur-3xl pointer-events-none" />

              {/* Floating Interactive Pill: Multimodal Input (Top-Left of bot) */}
              <div className="hidden sm:flex absolute -top-2 -left-4 xl:-left-8 z-20 items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-indigo-500/30 shadow-xl backdrop-blur-md animate-chat-bob hover:scale-105 transition-transform cursor-pointer">
                <div className="w-7 h-7 rounded-xl bg-indigo-500/10 dark:bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shrink-0">
                  <Bot size={15} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1 text-[9px] font-mono text-indigo-600 dark:text-indigo-300 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                    <span>Multimodal Vision &amp; Voice</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">
                    &quot;Analyze balance sheet in Telugu &amp; English&quot;
                  </p>
                </div>
              </div>

              {/* Floating Badge: Gemini Live Latency (Bottom-Right of bot) */}
              <div className="hidden sm:flex absolute -bottom-2 -right-2 xl:-right-6 z-20 items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-purple-500/30 shadow-lg backdrop-blur-md animate-float-reverse">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300 font-medium">Gemini Live Stream (~180ms)</span>
              </div>

              {/* The Enlarged AI Bot Visual */}
              <div className="animate-float-slow flex justify-center w-full relative z-10">
                <AIChatbotIllustration size="hero" className="scale-90 sm:scale-95 md:scale-100 transition-transform" />
              </div>
            </div>
          </div>

          {/* ===================== INTERACTIVE AI VISUAL AREA ===================== */}
          <div className="relative w-full max-w-5xl mx-auto mt-12 p-4 sm:p-8 rounded-3xl bg-white/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 backdrop-blur-xl shadow-xl dark:shadow-2xl overflow-hidden transition-colors duration-300">
            {/* Ambient Background Behind Orb */}
            <div className="absolute inset-0 bg-radial from-indigo-500/10 via-transparent to-transparent pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              {/* Interactive Orb Controller Bar */}
              <div className="flex items-center gap-2 p-1.5 rounded-full bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs font-mono mb-6">
                <span className="text-slate-500 dark:text-slate-400 px-2">Interactive AI Core:</span>
                <button
                  onClick={() => setOrbState('idle')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    orbState === 'idle'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Idle
                </button>
                <button
                  onClick={() => setOrbState('listening')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    orbState === 'listening'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Listening
                </button>
                <button
                  onClick={() => setOrbState('thinking')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    orbState === 'thinking'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Processing
                </button>
              </div>

              {/* Central Visual Stage with Floating Cards */}
              <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Left Floating Visual Card: Voice Waveform & Speech */}
                <div className="lg:col-span-3 flex flex-col gap-3 text-left">
                  <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-md animate-float-slow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
                        <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">Gemini Live Voice</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        ~180ms
                      </span>
                    </div>

                    {/* Animated Equalizer Waveform */}
                    <div className="flex items-center justify-center gap-1.5 h-12 bg-slate-50 dark:bg-slate-950/70 rounded-xl px-3 border border-slate-200 dark:border-slate-800/80">
                      {[40, 75, 55, 95, 80, 60, 90, 45, 65, 85].map((height, i) => (
                        <div
                          key={i}
                          className="w-1.5 rounded-full bg-gradient-to-t from-indigo-500 to-emerald-400 transition-all"
                          style={{
                            height: orbState === 'idle' ? `${height * 0.35}%` : `${height}%`,
                            animation: orbState !== 'idle' ? `waveBar 1.2s ease-in-out infinite alternate ${i * 0.1}s` : 'none',
                          }}
                        />
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>Bilingual Dialogue</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">Telugu / English</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span>Real-time interruption &amp; barge-in</span>
                  </div>
                </div>

                {/* Center: Interactive AI Orb with Glow Ring */}
                <div className="lg:col-span-6 flex flex-col items-center justify-center py-4">
                  <div
                    className="relative cursor-pointer transition-transform duration-500 hover:scale-105"
                    onClick={() => {
                      setOrbState(prev => (prev === 'idle' ? 'listening' : prev === 'listening' ? 'thinking' : 'idle'));
                    }}
                    title="Click to interact with SeeSpeak AI Core"
                  >
                    <div className="absolute -inset-4 rounded-full bg-indigo-500/20 blur-xl animate-pulse-glow pointer-events-none" />
                    <AIOrb size="hero" state={orbState} interactive={true} />
                  </div>

                  {/* Interactive Status Caption */}
                  <div className="mt-4 px-4 py-1.5 rounded-full bg-white/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 flex items-center gap-2 shadow-sm">
                    <Sparkle size={13} className="text-indigo-600 dark:text-indigo-400 animate-spin" />
                    <span>
                      {orbState === 'idle' && 'AI Assistant Ready • Tap to Speak'}
                      {orbState === 'listening' && 'Listening to Speech & Camera Feed...'}
                      {orbState === 'thinking' && 'Reasoning Multimodal Context...'}
                    </span>
                  </div>
                </div>

                {/* Right Floating Visual Card: Document & Vision Insights */}
                <div className="lg:col-span-3 flex flex-col gap-3 text-left">
                  <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-md animate-float-reverse">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Eye size={15} className="text-purple-500 dark:text-purple-400" />
                        <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">Vision &amp; Docs</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        Live OCR
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs">
                      <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-mono tracking-wider mb-1">
                        Detected Entity
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 font-medium line-clamp-1">
                        Financial Statement Q3.pdf
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                        <CheckCircle2 size={13} />
                        <span>Confidence: 99.4%</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>Per-User Scoped</span>
                      <span className="text-purple-600 dark:text-purple-400 font-medium">Zero-Leak Memory</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2.5">
                    <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Cryptographic session isolation</span>
                  </div>
                </div>
              </div>

              {/* Interactive Neural Network Visual Pipeline */}
              <div className="w-full mt-6">
                <AINeuralNetworkVisual />
              </div>
            </div>
          </div>

          {/* Value Propositions Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 w-full max-w-4xl mx-auto mt-8 text-xs text-slate-700 dark:text-slate-300 font-mono">
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/70 backdrop-blur-sm shadow-sm">
              <ShieldCheck size={15} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span>Strict Per-User Isolation</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/70 backdrop-blur-sm shadow-sm">
              <Zap size={15} className="text-amber-500 dark:text-amber-400 shrink-0" />
              <span>Sub-Second Live Audio</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/70 backdrop-blur-sm shadow-sm">
              <Eye size={15} className="text-purple-500 dark:text-purple-400 shrink-0" />
              <span>Live Camera &amp; Screen Vision</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/70 backdrop-blur-sm shadow-sm">
              <Globe2 size={15} className="text-blue-500 dark:text-blue-400 shrink-0" />
              <span>15+ Native Indian Languages</span>
            </div>
          </div>
        </section>

        {/* ===================== ENTERPRISE METRICS / TRUST BAR ===================== */}
        <section className="relative border-y border-slate-200 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-950/60 py-10 px-4 transition-colors duration-300">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col items-center">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                &lt; 250ms
              </span>
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Spoken Voice Latency</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                15+
              </span>
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Native Script Languages</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                100%
              </span>
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Private Data Isolation</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono tracking-tight">
                6
              </span>
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Specialized AI Workspaces</span>
            </div>
          </div>
        </section>

        {/* ===================== AI CAPABILITIES SECTION ===================== */}
        <section id="capabilities" className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-mono mb-3">
              <Layers size={13} />
              <span>Full-Stack Multimodal Intelligence</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              Six Purpose-Built AI Engines
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base font-light">
              Every workspace has dedicated context isolation, tailored Gemini prompts, and specialized reasoning pipelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.id}
                onClick={() => {
                  if (isAuthenticated) {
                    onNavigate(feature.route);
                  } else {
                    onNavigate('/login');
                  }
                }}
                className="group relative p-6 sm:p-7 rounded-3xl bg-white/90 hover:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900/90 border border-slate-200 hover:border-indigo-200 dark:border-slate-800 dark:hover:border-slate-700/80 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 group-hover:scale-110 transition-transform">
                      {getFeatureIcon(feature.id)}
                    </div>
                    <div className="text-slate-400 group-hover:text-slate-900 dark:text-slate-500 dark:group-hover:text-white transition-colors">
                      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono mb-3">
                    {feature.tagline}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-light">
                    {feature.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-500 dark:text-slate-500">
                    {feature.supportedMimeTypes.slice(0, 2).join(', ')}
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    Launch <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===================== HOW IT WORKS FLOW ===================== */}
        <section id="how-it-works" className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-mono mb-3">
              <Cpu size={13} />
              <span>End-to-End Pipeline</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
              How SeeSpeak AI Works
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base font-light">
              From raw documents and live sensors to structured intelligence and verbal conversation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">01</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-3 mb-2">Upload or Input</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Provide PDFs, images, video recordings, enable live microphone, or stream your webcam and desktop screen.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-slate-500">
                Multi-format Ingestion
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">02</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-3 mb-2">AI Processing</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Gemini Live multimodal models analyze video frames, extract OCR text, and evaluate audio speech in parallel.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-slate-500">
                Neural Multimodal Engine
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">03</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-3 mb-2">Insights &amp; Response</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Receive visual bounding-box highlights, citations, structured summaries, and natural spoken voice in 15+ native languages.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-slate-500">
                Sub-second Turnaround
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">04</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-3 mb-2">Real Action</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Generate support tickets, review interview evaluation rubrics, export reports, and track isolated user analytics.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-slate-500">
                User-Isolated Storage
              </div>
            </div>
          </div>
        </section>

        {/* ===================== INTERACTIVE ANALYTICS PREVIEW ===================== */}
        <section id="analytics-preview" className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="rounded-3xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 sm:p-10 backdrop-blur-xl shadow-xl dark:shadow-2xl overflow-hidden transition-colors duration-300">
            {/* Disclaimer Pill */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono mb-2">
                  <BarChart3 size={13} />
                  <span>Interactive Illustrative Preview</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  Intelligent Analytics &amp; Performance Tracking
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-light">
                  Strictly scoped per user. User A never sees User B's metrics, interview evaluations, or document histories.
                </p>
              </div>

              {/* Tab Selector */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium">
                <button
                  onClick={() => setActiveAnalyticsTab('overview')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeAnalyticsTab === 'overview'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveAnalyticsTab('radar')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeAnalyticsTab === 'radar'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Interview Radar
                </button>
                <button
                  onClick={() => setActiveAnalyticsTab('modules')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeAnalyticsTab === 'modules'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Module Breakdown
                </button>
              </div>
            </div>

            {/* Illustrative Tab Content */}
            {activeAnalyticsTab === 'overview' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                    <span className="text-xs font-mono">Total Workspaces</span>
                    <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">28</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 font-mono">
                    <TrendingUp size={12} />
                    <span>+12 this week</span>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                    <span className="text-xs font-mono">Doc Queries</span>
                    <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">142</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 font-mono">
                    <TrendingUp size={12} />
                    <span>99.2% citations</span>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                    <span className="text-xs font-mono">Mock Interviews</span>
                    <Award size={16} className="text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">88/100</div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-2 flex items-center gap-1 font-mono">
                    <span>Avg score (Senior SWE)</span>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                    <span className="text-xs font-mono">Resolution Rate</span>
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">96.5%</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 font-mono">
                    <span>18 tickets resolved</span>
                  </div>
                </div>
              </div>
            )}

            {activeAnalyticsTab === 'radar' && (
              <div className="p-6 rounded-2xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 animate-fadeIn">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Award size={16} className="text-rose-600 dark:text-rose-400" />
                  <span>Interview Competency Breakdown (Sample Evaluation)</span>
                </h4>
                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-700 dark:text-slate-300">Technical Depth &amp; Correctness</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">92%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-900 overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: '92%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-700 dark:text-slate-300">Communication &amp; Fluency</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">88%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-900 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: '88%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-700 dark:text-slate-300">Problem Solving &amp; Edge Cases</span>
                      <span className="text-purple-600 dark:text-purple-400 font-bold">85%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-900 overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: '85%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-700 dark:text-slate-300">System Architecture</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">90%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-900 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '90%' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeAnalyticsTab === 'modules' && (
              <div className="p-6 rounded-2xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 animate-fadeIn">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Module Usage Share</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">Document Analysis</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">35%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-rose-600 dark:text-rose-400 font-mono">AI Interviewer</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">25%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">Customer Support</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">20%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-mono">Visual Intelligence</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">12%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-mono">Audio &amp; Video</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">8%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">Data &amp; Study</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">10%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ===================== FINAL CALL TO ACTION (CTA) ===================== */}
        <section className="relative max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-b from-indigo-50 via-white to-slate-50 dark:from-indigo-900/40 dark:via-slate-900/80 dark:to-slate-950 border border-indigo-200 dark:border-indigo-500/30 shadow-xl dark:shadow-2xl relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-indigo-500/20 blur-3xl pointer-events-none" />

            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4 relative z-10">
              Ready to Experience SeeSpeak AI?
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-xl mx-auto mb-8 font-light relative z-10 leading-relaxed">
              Join the intelligent multimodal workspace. Speak naturally, analyze visually, and explore your information with absolute security.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto relative z-10">
              {isAuthenticated ? (
                <button
                  onClick={() => onNavigate('/app')}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base shadow-xl shadow-indigo-600/30 transition-all cursor-pointer active:scale-95 min-h-[48px]"
                >
                  <span>Enter Workspace</span>
                  <ArrowRight size={18} />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onNavigate('/register')}
                    className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-base shadow-xl shadow-indigo-600/30 transition-all cursor-pointer active:scale-95 min-h-[48px]"
                  >
                    <span>Get Started Free</span>
                    <ArrowRight size={18} />
                  </button>
                  <button
                    onClick={() => onNavigate('/login')}
                    className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-300 hover:border-slate-400 dark:border-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white font-medium text-base shadow-sm transition-all cursor-pointer active:scale-95 min-h-[48px]"
                  >
                    <LogIn size={18} className="text-slate-500 dark:text-slate-400" />
                    <span>Login</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Modern SaaS Footer */}
      <footer className="relative border-t border-slate-200 dark:border-slate-900 bg-slate-100/90 dark:bg-slate-950 py-12 px-4 sm:px-8 transition-colors duration-300">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Sparkles size={14} />
              </div>
              <span className="font-extrabold text-sm uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                SeeSpeak AI
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-2 font-mono">
              Intelligent Multimodal AI Workspace &copy; {new Date().getFullYear()}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 dark:text-slate-400 font-mono">
            <button onClick={() => onNavigate('/login')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Login
            </button>
            <button onClick={() => onNavigate('/register')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Register
            </button>
            <button onClick={() => onNavigate('/forgot-password')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Password Reset
            </button>
            <button onClick={() => onNavigate(isAuthenticated ? '/app' : '/login')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Dashboard
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
