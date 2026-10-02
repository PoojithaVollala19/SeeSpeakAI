import React from 'react';
import { ArrowLeft, Headphones, Plus } from 'lucide-react';
import { SupportedLanguage } from '../types';
import { getLanguageInfo } from '../config/languages';
import { FeatureSwitcher } from './FeatureSwitcher';
import { ThemeToggle } from './ThemeToggle';

interface ConversationHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onNewConversation?: () => void;
  language?: SupportedLanguage;
  showHeadphoneBanner?: boolean;
  activeFeatureId?: string;
  onSelectFeature?: (route: string) => void;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  title,
  subtitle,
  onBack,
  onNewConversation,
  language = 'en',
  showHeadphoneBanner = false,
  activeFeatureId,
  onSelectFeature,
}) => {
  const langInfo = getLanguageInfo(language);

  return (
    <div className="w-full bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 sticky top-0 z-30 px-3 md:px-5 py-2.5 transition-colors duration-200">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Back button + Title */}
        <div className="flex items-center justify-between md:justify-start gap-3 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
              title="Back to Overview"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="min-w-0">
              <h1 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Mobile Right Quick Action & Theme */}
          <div className="flex items-center gap-1.5 md:hidden">
            <ThemeToggle size="sm" />
            {onNewConversation && (
              <button
                onClick={onNewConversation}
                className="p-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium cursor-pointer"
                title="New Chat"
              >
                <Plus size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Center: Feature Switcher */}
        {activeFeatureId && onSelectFeature && (
          <div className="hidden md:flex justify-center flex-1 max-w-xl mx-auto">
            <FeatureSwitcher
              activeFeatureId={activeFeatureId}
              onSelectFeature={onSelectFeature}
            />
          </div>
        )}

        {/* Right: Language Pill, ThemeToggle, New Chat, Headphone reminder */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          {showHeadphoneBanner && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
              <Headphones size={13} className="text-indigo-600 dark:text-indigo-400" />
              <span>Use headphones</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
            <span>{langInfo.flag}</span>
            <span className="font-medium hidden sm:inline">{langInfo.name}</span>
          </div>

          <ThemeToggle size="sm" />

          {onNewConversation && (
            <button
              onClick={onNewConversation}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm cursor-pointer"
              title="Start New Conversation in this workspace"
            >
              <Plus size={14} />
              <span>New Chat</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
