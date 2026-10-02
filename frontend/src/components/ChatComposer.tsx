import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, MicOff, Globe } from 'lucide-react';
import { SupportedLanguage } from '../types';
import { SUPPORTED_LANGUAGES } from '../config/languages';
import { QuickActionsMenu } from './QuickActionsMenu';

interface ChatComposerProps {
  onSendMessage: (message: string, inputMode?: 'text' | 'voice') => void;
  onTriggerFileUpload?: () => void;
  selectedLanguage: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  isLoading?: boolean;
  placeholder?: string;
  hasAttachedFiles?: boolean;
  moduleTitle?: string;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  onTriggerFileUpload,
  selectedLanguage,
  onSelectLanguage,
  isLoading = false,
  placeholder = 'Ask anything about your files or prompt...',
  hasAttachedFiles = false,
  moduleTitle,
}) => {
  const [text, setText] = useState('');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const wasDictatedRef = useRef<boolean>(false);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || isLoading) return;
    if (isDictating && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsDictating(false);
    }
    const mode: 'text' | 'voice' = wasDictatedRef.current ? 'voice' : 'text';
    onSendMessage(text.trim(), mode);
    wasDictatedRef.current = false;
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    wasDictatedRef.current = false; // User typed manually
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleQuickAction = (actionPrompt: string, _actionName: string) => {
    let finalPrompt = actionPrompt;
    if (text.trim()) {
      finalPrompt = `${text.trim()}\n\n${actionPrompt}`;
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
    wasDictatedRef.current = false;
    onSendMessage(finalPrompt, 'text');
  };

  // Toggle Speech Recognition dictation into the text area
  const toggleDictation = () => {
    setDictationError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setDictationError('Speech recognition is not supported in this browser.');
      setTimeout(() => setDictationError(null), 4000);
      return;
    }

    if (isDictating) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsDictating(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = currentLang.speechCode || 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsDictating(true);
        wasDictatedRef.current = true;
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setText(transcript);
          wasDictatedRef.current = true;
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setDictationError('Microphone permission blocked. Please allow mic in browser settings.');
        } else {
          setDictationError(`Mic error: ${event.error}`);
        }
        setIsDictating(false);
        setTimeout(() => setDictationError(null), 4000);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setDictationError('Failed to initialize microphone dictation.');
      setIsDictating(false);
      setTimeout(() => setDictationError(null), 4000);
    }
  };

  // Close language popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full relative">
      {/* Dictation error badge */}
      {dictationError && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-red-500/10 border border-red-500/30 text-red-300 px-3 py-1.5 rounded-xl text-xs flex items-center justify-between z-40">
          <span>{dictationError}</span>
          <button onClick={() => setDictationError(null)} className="text-red-400 hover:text-white ml-2">×</button>
        </div>
      )}

      {/* Language Selector Dropdown Popup */}
      {showLangMenu && (
        <div
          ref={menuRef}
          className="absolute bottom-full mb-2 left-0 w-64 max-h-72 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-2xl p-2 z-50 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Select Response Language
          </div>
          <div className="space-y-0.5">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  onSelectLanguage(lang.code);
                  setShowLangMenu(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                  selectedLanguage === lang.code
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </span>
                <span className="text-[11px] opacity-70">{lang.nativeName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Composer Box */}
      <div className="flex flex-col rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 focus-within:border-indigo-500/70 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-lg p-2.5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            isDictating
              ? `Listening in ${currentLang.name}... Speak now...`
              : hasAttachedFiles
              ? 'Ask a question or choose a Quick Action for attached file(s)...'
              : placeholder
          }
          rows={1}
          disabled={isLoading}
          className={`w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm md:text-base resize-none focus:outline-none px-2 py-1 max-h-40 leading-relaxed ${
            isDictating ? 'placeholder-rose-500 dark:placeholder-rose-400 animate-pulse' : ''
          }`}
        />

        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80 mt-1 gap-2">
          {/* Left Action Controls: Upload + Quick Actions + Language */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {onTriggerFileUpload && (
              <button
                type="button"
                onClick={onTriggerFileUpload}
                title="Attach document or media"
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Paperclip size={18} />
              </button>
            )}

            {/* Quick Actions Menu Trigger */}
            <QuickActionsMenu
              onSelectAction={handleQuickAction}
              disabled={isLoading}
            />

            {/* Language Selector Trigger */}
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <Globe size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>{currentLang.flag}</span>
              <span className="font-medium hidden sm:inline">{currentLang.name}</span>
            </button>
          </div>

          {/* Right Action Controls: Dictation Mic + Live Voice + Send */}
          <div className="flex items-center gap-2">
            {/* Dictation Mic Button */}
            <button
              type="button"
              onClick={toggleDictation}
              title={
                isDictating
                  ? 'Stop Dictating'
                  : `Dictate prompt in ${currentLang.name} (AI will speak answer aloud)`
              }
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isDictating
                  ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/40'
                  : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {isDictating ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Send Message Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!text.trim() || isLoading}
              className={`p-2.5 rounded-xl font-medium transition-all duration-150 flex items-center justify-center ${
                text.trim() && !isLoading
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
