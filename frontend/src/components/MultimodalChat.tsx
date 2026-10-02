import React, { useRef, useEffect, useState } from 'react';
import { Bot, User, Sparkles, AlertCircle, FileText, Check, Copy, Volume2 } from 'lucide-react';
import { Conversation, Message, SupportedLanguage, ConversationFile } from '../types';
import { FileCard } from './FileCard';
import { FileUpload } from './FileUpload';
import { ChatComposer } from './ChatComposer';
import { detectScriptLanguage, getSpeechLocale } from '../utils/languageDetector';

import { getUploadConfig } from '../config/uploadConfig';

interface MultimodalChatProps {
  conversation: Conversation | null;
  messages: Message[];
  attachedFiles: ConversationFile[];
  onSendMessage: (text: string, inputMode?: 'text' | 'voice') => Promise<void>;
  onFileUpload: (file: File) => Promise<void>;
  onRemoveFile?: (id: string) => Promise<void>;
  selectedLanguage: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  isLoading: boolean;
  streamingText?: string;
  error?: string | null;
  featureId: string;
  featureTitle: string;
  featureDescription: string;
  samplePrompts?: { text: string; langHint: string }[];
}

export const MultimodalChat: React.FC<MultimodalChatProps> = ({
  conversation,
  messages,
  attachedFiles,
  onSendMessage,
  onFileUpload,
  onRemoveFile,
  selectedLanguage,
  onSelectLanguage,
  isLoading,
  streamingText,
  error,
  featureId,
  featureTitle,
  featureDescription,
  samplePrompts = [],
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, isLoading]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (text: string, id: string) => {
    if ('speechSynthesis' in window) {
      if (speakingId === id) {
        window.speechSynthesis.cancel();
        setSpeakingId(null);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const detected = detectScriptLanguage(text) || selectedLanguage;
      utterance.lang = getSpeechLocale(detected);
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-5xl mx-auto w-full px-3 md:px-6 py-3 md:py-5 overflow-hidden">
      {/* Attached Files Context Bar - Sleek, compact space-saving preview */}
      {attachedFiles.length > 0 && (
        <div className="mb-2.5 px-3 py-1.5 bg-slate-100/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 rounded-xl flex items-center justify-between gap-3 backdrop-blur-md shadow-sm shrink-0 transition-colors duration-200">
          <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-thin flex-1 min-w-0">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 shrink-0 select-none">
              <FileText size={13} className="text-indigo-600 dark:text-indigo-400" />
              <span>Files ({attachedFiles.length}):</span>
            </span>
            <div className="flex items-center gap-2 flex-nowrap">
              {attachedFiles.map((file) => (
                <FileCard key={file.id} file={file} onRemove={onRemoveFile} />
              ))}
            </div>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono shrink-0 hidden sm:inline-block">Context Ready</span>
        </div>
      )}

      {/* Main Conversation Scroll Area */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-800">
        {messages.length === 0 && !streamingText ? (
          /* Empty Workspace State */
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 shadow-inner">
              <Sparkles size={22} />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
              {featureTitle}
            </h2>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
              {featureDescription}
            </p>

            {/* Direct Upload Box if no files uploaded yet */}
            {attachedFiles.length === 0 && (
              <div className="w-full max-w-md mb-6">
                <FileUpload
                  onFileUpload={onFileUpload}
                  featureTitle={featureTitle}
                  featureId={featureId}
                  isUploading={isLoading}
                />
              </div>
            )}

            {/* Smart Suggestions Chips */}
            {samplePrompts.length > 0 && (
              <div className="w-full max-w-lg text-left mt-2">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 font-mono">
                  Suggested Inquiries
                </div>
                <div className="flex flex-wrap gap-2">
                  {samplePrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSendMessage(p.text)}
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all hover:border-indigo-300 dark:hover:border-indigo-500/40 shadow-sm cursor-pointer"
                    >
                      <span>{p.text}</span>
                      <span className="text-[10px] px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {p.langHint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Message Stream */
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 text-sm md:text-base animate-fadeIn ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5 shadow-sm">
                  <Bot size={17} />
                </div>
              )}

              <div
                className={`group relative max-w-[88%] md:max-w-[80%] px-4 py-3 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20'
                    : 'bg-white dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800/90 rounded-tl-none shadow-sm'
                }`}
              >
                {msg.content}

                {/* Assistant Message Actions (Copy & Listen) */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/60 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check size={12} className="text-emerald-500 dark:text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      onClick={() => handleSpeak(msg.content, msg.id)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Read aloud"
                    >
                      <Volume2 size={12} className={speakingId === msg.id ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : ''} />
                      <span>{speakingId === msg.id ? 'Stop' : 'Listen'}</span>
                    </button>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 mt-0.5 shadow-sm">
                  <User size={17} />
                </div>
              )}
            </div>
          ))
        )}

        {/* Live Streaming Response preview */}
        {streamingText && (
          <div className="flex items-start gap-3 text-sm md:text-base animate-fadeIn justify-start">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5 shadow-sm">
              <Bot size={17} />
            </div>
            <div className="max-w-[88%] md:max-w-[80%] px-4 py-3 rounded-2xl bg-white dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-tl-none shadow-sm leading-relaxed whitespace-pre-wrap">
              {streamingText}
              <span className="inline-block w-2 h-4 ml-1 bg-indigo-500 dark:bg-indigo-400 rounded animate-pulse" />
            </div>
          </div>
        )}

        {/* Loading / Thinking Indicator */}
        {isLoading && !streamingText && (
          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 pl-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 animate-pulse shadow-sm">
              <Sparkles size={16} />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-ping" />
              <span>Analyzing grounded context with Gemini...</span>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 dark:text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Bottom Composer */}
      <div className="mt-3 shrink-0">
        <ChatComposer
          onSendMessage={onSendMessage}
          moduleTitle={featureTitle}
          onTriggerFileUpload={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = getUploadConfig(featureId).accept;
            input.onchange = (e: any) => {
              if (e.target.files && e.target.files[0]) {
                onFileUpload(e.target.files[0]);
              }
            };
            input.click();
          }}
          selectedLanguage={selectedLanguage}
          onSelectLanguage={onSelectLanguage}
          isLoading={isLoading}
          hasAttachedFiles={attachedFiles.length > 0}
        />
      </div>
    </div>
  );
};
