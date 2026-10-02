import React, { useState, useId } from 'react';
import { Sparkles, MessageSquare, Bot } from 'lucide-react';

interface AIChatbotIllustrationProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
}

export const AIChatbotIllustration: React.FC<AIChatbotIllustrationProps> = ({
  className = '',
  size = 'md',
}) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [isWaving, setIsWaving] = useState(false);
  const rawId = useId();
  const id = rawId.replace(/[:]/g, '');

  const messages = [
    '👋 Hi! I can analyze documents, images, or chat with you live!',
    '🎙️ Ask questions in Telugu, Hindi, English, or 15+ languages.',
    '📄 Upload PDFs or spreadsheets for instant cited summaries.',
    '👁️ Turn on camera vision for live AI screen & visual review!',
  ];

  const handleInteraction = () => {
    setIsWaving(true);
    setMessageIndex((prev) => (prev + 1) % messages.length);
    setTimeout(() => setIsWaving(false), 800);
  };

  const dimensions = {
    sm: { width: 140, height: 160 },
    md: { width: 190, height: 210 },
    lg: { width: 240, height: 265 },
    xl: { width: 290, height: 320 },
    hero: { width: 340, height: 375 },
  }[size];

  const bubbleMaxWidth = size === 'hero' ? 'max-w-[320px]' : size === 'xl' ? 'max-w-[280px]' : 'max-w-[220px]';

  return (
    <div
      onClick={handleInteraction}
      className={`relative inline-flex flex-col items-center select-none cursor-pointer group ${className}`}
      title="Click to interact with SeeSpeak AI Assistant"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleInteraction();
        }
      }}
    >
      {/* Floating Interactive Speech Bubble */}
      <div className={`animate-chat-bob mb-3 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-indigo-500/30 backdrop-blur-md shadow-xl shadow-indigo-500/10 ${bubbleMaxWidth} transition-all group-hover:border-indigo-400 group-hover:shadow-indigo-500/20 text-center`}>
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-indigo-600 dark:text-indigo-300 font-semibold mb-0.5">
          <Sparkles size={11} className="text-indigo-500 dark:text-indigo-400 animate-spin" />
          <span>SeeSpeak Assistant</span>
        </div>
        <p className="text-xs text-slate-800 dark:text-slate-200 leading-snug font-medium">
          {messages[messageIndex]}
        </p>
        {/* Subtle speech tail */}
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-indigo-500/30 transform rotate-45" />
      </div>

      {/* Modern Friendly AI Chatbot Vector Illustration */}
      <div className="relative transition-transform duration-300 group-hover:scale-105 active:scale-95">
        {/* Ambient Backlight Glow */}
        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse-glow pointer-events-none" />

        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox="0 0 200 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 drop-shadow-xl max-w-full h-auto"
        >
          <defs>
            {/* Holographic Body Gradients */}
            <linearGradient id="bodyGrad" x1="50" y1="50" x2="150" y2="190" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4f46e5" />
              <stop offset="0.5" stopColor="#312e81" />
              <stop offset="1" stopColor="#1e1b4b" />
            </linearGradient>

            <linearGradient id="headGrad" x1="60" y1="40" x2="140" y2="120" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366f1" />
              <stop offset="0.6" stopColor="#4338ca" />
              <stop offset="1" stopColor="#1e1b4b" />
            </linearGradient>

            <linearGradient id="visorGrad" x1="70" y1="65" x2="130" y2="105" gradientUnits="userSpaceOnUse">
              <stop stopColor="#030712" />
              <stop offset="0.5" stopColor="#0f172a" />
              <stop offset="1" stopColor="#030712" />
            </linearGradient>

            <linearGradient id="eyeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#38bdf8" />
              <stop offset="1" stopColor="#34d399" />
            </linearGradient>

            <linearGradient id="beamGrad" x1="100" y1="180" x2="100" y2="215" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366f1" stopOpacity="0.6" />
              <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Levitation Anti-gravity Beam Underneath */}
          <ellipse cx="100" cy="208" rx="42" ry="7" fill="url(#beamGrad)" />
          <ellipse cx="100" cy="204" rx="28" ry="4" fill="#818cf8" fillOpacity="0.4" />

          {/* Floating Robot Body */}
          <path
            d="M70 135 C70 125, 130 125, 130 135 L125 180 C125 192, 75 192, 75 180 Z"
            fill="url(#bodyGrad)"
            stroke="#6366f1"
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />

          {/* Body Core Emblem / Microphone Spark */}
          <circle cx="100" cy="155" r="12" fill="#0f172a" stroke="#4f46e5" strokeWidth="1.5" />
          <circle cx="100" cy="155" r="7" fill="#6366f1" fillOpacity="0.6" className="animate-pulse" />
          <path d="M96 155 L104 155 M100 151 L100 159" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />

          {/* Cute Floating Left Hand */}
          <g className={`transition-transform duration-300 ${isWaving ? '-translate-y-2 rotate-12' : ''}`}>
            <ellipse cx="52" cy="150" rx="9" ry="12" fill="url(#headGrad)" stroke="#818cf8" strokeWidth="1" />
            <circle cx="50" cy="144" r="3" fill="#38bdf8" />
          </g>

          {/* Cute Floating Right Hand (Waves on click) */}
          <g className={`transition-transform duration-300 origin-bottom-left ${isWaving ? '-translate-y-4 -rotate-12' : ''}`}>
            <ellipse cx="148" cy="150" rx="9" ry="12" fill="url(#headGrad)" stroke="#818cf8" strokeWidth="1" />
            <circle cx="150" cy="144" r="3" fill="#38bdf8" />
          </g>

          {/* Antenna Stem & Glowing Sensor Ball */}
          <line x1="100" y1="46" x2="100" y2="24" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="100" cy="20" r="7" fill="#10b981" filter="url(#neonGlow)" />
          <circle cx="100" cy="20" r="3" fill="#ffffff" />
          {/* Signal Wave Arcs */}
          <path
            d="M90 14 C96 9, 104 9, 110 14"
            stroke="#34d399"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
            className="animate-pulse"
          />

          {/* Robot Head (Rounded Capsule) */}
          <rect
            x="52"
            y="44"
            width="96"
            height="80"
            rx="36"
            fill="url(#headGrad)"
            stroke="#818cf8"
            strokeWidth="1.8"
          />

          {/* High-Gloss Visor Screen */}
          <rect
            x="62"
            y="56"
            width="76"
            height="56"
            rx="24"
            fill="url(#visorGrad)"
            stroke="#312e81"
            strokeWidth="1.5"
          />

          {/* Visor Specular Glass Reflection */}
          <path
            d="M74 62 C85 58, 115 58, 126 62 C105 66, 85 70, 74 62 Z"
            fill="#ffffff"
            fillOpacity="0.15"
          />

          {/* Cyan Luminous Eyes (with subtle blink animation) */}
          <g className="animate-eye-blink">
            {/* Left Eye */}
            <rect x="76" y="74" width="16" height="18" rx="8" fill="url(#eyeGrad)" filter="url(#neonGlow)" />
            <circle cx="82" cy="79" r="3.5" fill="#ffffff" />

            {/* Right Eye */}
            <rect x="108" y="74" width="16" height="18" rx="8" fill="url(#eyeGrad)" filter="url(#neonGlow)" />
            <circle cx="114" cy="79" r="3.5" fill="#ffffff" />
          </g>

          {/* Gentle Visor Smile Line */}
          <path
            d="M93 100 Q100 105 107 100"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />

          {/* Cheerful Cheek Glows */}
          <circle cx="72" cy="94" r="3" fill="#f43f5e" fillOpacity="0.4" />
          <circle cx="128" cy="94" r="3" fill="#f43f5e" fillOpacity="0.4" />
        </svg>
      </div>

      {/* Tap Hint */}
      <span className="text-[10px] font-mono text-slate-400 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
        (tap to chat)
      </span>
    </div>
  );
};
