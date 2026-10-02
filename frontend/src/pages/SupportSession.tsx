import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConversationHeader } from '../components/ConversationHeader';
import { SupportTicketManager } from '../components/SupportTicketManager';
import { useTranslation } from '../locales/i18n';
import { SUPPORTED_LANGUAGES, getLanguageInfo, getSpeechLocaleForText } from '../config/languages';
import {
  Ticket,
  Sparkles,
  MessageSquare,
  Check,
  Send,
  Globe,
  Mic,
  MicOff,
  AlertTriangle,
  Camera,
  CameraOff,
  Monitor,
  X,
  RefreshCw,
  Plus
} from 'lucide-react';
import { SupportResultDashboard, SupportSummaryData } from '../components/SupportResultDashboard';
import { SupportedLanguage, SupportTicket, Message, TranscriptTurn, Conversation } from '../types';
import { useCamera } from '../hooks/useCamera';
import { authFetch } from '../utils/authFetch';
import { useScreenShare } from '../hooks/useScreenShare';

interface SupportSessionProps {
  conversationId?: string;
  onBack: () => void;
  selectedLanguage: SupportedLanguage;
  onSelectLanguage?: (lang: SupportedLanguage) => void;
  onSelectFeature?: (route: string) => void;
  onNewConversation?: () => void;
  onConversationCreated?: (conv: Conversation) => void;
}

export const SupportSession: React.FC<SupportSessionProps> = ({
  conversationId,
  onBack,
  selectedLanguage,
  onSelectLanguage,
  onSelectFeature,
  onNewConversation,
  onConversationCreated,
}) => {
  const { t } = useTranslation(selectedLanguage);

  // Active Conversation State
  const [activeConvId, setActiveConvId] = useState<string | undefined>(conversationId);

  // Support Tickets Integration
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [isTicketManagerOpen, setIsTicketManagerOpen] = useState(false);

  // Text Chat State
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);

  // Result Summary Screen State
  const [summaryData, setSummaryData] = useState<SupportSummaryData | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [startTime] = useState<number>(Date.now());

  // Camera & Screen Share Hooks
  const camera = useCamera();
  const screenShare = useScreenShare();

  // Dictation State
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Load existing conversation data strictly by ID (Refresh & History Click Safety)
  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data: Conversation = await res.json();
        setChatMessages(data.messages || []);
        if (data.ticket) {
          setActiveTicket(data.ticket);
        }
        if (data.summary) {
          setSummaryData(data.summary);
        } else {
          setSummaryData(null);
        }
      }
    } catch (err) {
      console.error('Failed to load support conversation:', err);
    }
  }, []);

  // Sync with prop conversationId
  useEffect(() => {
    setActiveConvId(conversationId);
    if (conversationId) {
      loadConversation(conversationId);
    } else {
      setActiveTicket(null);
      setChatMessages([]);
      setSummaryData(null);
    }
  }, [conversationId, loadConversation]);

  // Clean up all media streams on unmount or navigation
  useEffect(() => {
    return () => {
      camera.stopCamera();
      screenShare.stopScreenShare();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle Camera Toggle with graceful permission handling
  const handleToggleCamera = async () => {
    setMediaNotice(null);
    if (camera.isActive) {
      camera.stopCamera();
    } else {
      try {
        await camera.startCamera();
      } catch (err: any) {
        setMediaNotice('Camera access was denied. You can continue using text or voice support.');
      }
    }
  };

  // Watch camera errors
  useEffect(() => {
    if (camera.error) {
      setMediaNotice('Camera access was denied. You can continue using text or voice support.');
      camera.clearError();
    }
  }, [camera.error]);

  // Handle Screen Share Toggle with graceful permission handling
  const handleToggleScreenShare = async () => {
    setMediaNotice(null);
    if (screenShare.isSharing) {
      screenShare.stopScreenShare();
    } else {
      try {
        await screenShare.startScreenShare();
      } catch (err: any) {
        setMediaNotice('Screen sharing was cancelled. You can continue the support conversation.');
      }
    }
  };

  // Watch screen share errors
  useEffect(() => {
    if (screenShare.error) {
      setMediaNotice('Screen sharing was cancelled. You can continue the support conversation.');
      screenShare.clearError();
    }
  }, [screenShare.error]);

  // Snapshot fresh visual frame if Camera or Screen Share is actively running
  const captureActiveVisualFrame = async (): Promise<{ data: string; mime_type: string; source: 'camera' | 'screen' | 'camera_and_screen' } | undefined> => {
    try {
      console.log(`[CustomerSupport] Checking active media streams — Camera active: ${camera.isActive}, Screen sharing: ${screenShare.isSharing}`);
      if (!camera.isActive && !screenShare.isSharing) {
        return undefined;
      }

      let frameDataUrl: string | null = null;
      let visualSource: 'camera' | 'screen' | 'camera_and_screen' = 'camera';

      if (screenShare.isSharing && camera.isActive) {
        visualSource = 'camera_and_screen';
        frameDataUrl = await screenShare.captureFrame();
        if (!frameDataUrl) {
          frameDataUrl = await camera.captureFrame();
        }
      } else if (screenShare.isSharing) {
        visualSource = 'screen';
        frameDataUrl = await screenShare.captureFrame();
      } else if (camera.isActive) {
        visualSource = 'camera';
        frameDataUrl = await camera.captureFrame();
      }

      if (frameDataUrl) {
        const mime = frameDataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        const base64Data = frameDataUrl.includes(';base64,') ? frameDataUrl.split(';base64,')[1] : frameDataUrl;
        console.log(`[CustomerSupport] Fresh visual frame captured successfully: ${base64Data.length} base64 chars, MIME: ${mime}, source: ${visualSource}`);
        return {
          data: base64Data,
          mime_type: mime,
          source: visualSource,
        };
      } else {
        console.warn('[CustomerSupport] Visual stream active, but frame could not be captured.');
      }
    } catch (e) {
      console.warn('[CustomerSupport] Could not capture visual context frame:', e);
    }
    return undefined;
  };

  // Dynamic Session Summary Generation
  const generateSessionSummary = async (transcript: TranscriptTurn[]) => {
    setIsSummarizing(true);
    const durationSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    try {
      const res = await authFetch('/api/tickets/summarize-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: activeTicket?.id,
          conversation_id: activeConvId,
          transcript: transcript,
          duration_seconds: durationSec,
          language: selectedLanguage,
        }),
      });

      if (res.ok) {
        const data: SupportSummaryData = await res.json();
        setSummaryData(data);
        if (data.ticket_id && activeTicket) {
          setActiveTicket((prev) => prev ? { ...prev, status: 'Resolved' } : null);
        }
      }
    } catch (err) {
      console.error('Failed to summarize support session:', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Complete Inquiry & View Summary
  const handleEndChatSession = async () => {
    // 1. Stop active media streams
    camera.stopCamera();
    screenShare.stopScreenShare();
    if (isDictating && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      setIsDictating(false);
    }

    // 2. Build conversation transcript
    const chatTranscript: TranscriptTurn[] = chatMessages.map((m) => ({
      speaker: m.role === 'user' ? 'user' : 'ai',
      text: m.content,
      timestamp: m.created_at,
      language: selectedLanguage,
    }));

    // 3. Generate dynamic summary & persist
    await generateSessionSummary(chatTranscript);
  };

  // Restart / New Inquiry
  const handleRestart = () => {
    setSummaryData(null);
    setChatMessages([]);
    setActiveTicket(null);
    setActiveConvId(undefined);
    if (onNewConversation) {
      onNewConversation();
    }
  };

  // Text Chat Message Send with SSE / API
  const handleSendChatMessage = async (overrideText?: string, inputMode: 'text' | 'voice' = 'text') => {
    const textToSend = (overrideText !== undefined ? overrideText : inputText).trim();
    if (!textToSend || isSendingChat) return;
    setInputText('');
    setErrorMessage(null);
    setMediaNotice(null);

    let currentConvId = activeConvId;

    // 1. If no conversation exists yet for this support session, auto-create one now
    if (!currentConvId) {
      try {
        const createRes = await authFetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feature: 'customer-support',
            language: selectedLanguage,
            title: textToSend.slice(0, 45),
          }),
        });
        if (createRes.ok) {
          const newConv: Conversation = await createRes.json();
          currentConvId = newConv.id;
          setActiveConvId(currentConvId);
          if (onConversationCreated) {
            onConversationCreated(newConv);
          }
        }
      } catch (err) {
        console.error('Failed to initialize support conversation:', err);
      }
    }

    const userMsg: Message = {
      id: Math.random().toString(36).slice(2),
      conversation_id: currentConvId || 'support_session',
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsSendingChat(true);

    // Capture fresh visual frame if camera or screen sharing is active
    let visualPayload: string | undefined = undefined;
    if (camera.isActive || screenShare.isSharing) {
      console.log('[CustomerSupport] Capturing visual frame before building AI request...');
      const captured = await captureActiveVisualFrame();
      if (captured) {
        visualPayload = JSON.stringify(captured);
        console.log(`[CustomerSupport] AI visual payload prepared and attached to request (${captured.source}, ${captured.data.length} chars).`);
      } else {
        console.warn('[CustomerSupport] Camera/Screen active, but frame could not be captured.');
      }
    }

    try {
      const res = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: currentConvId,
          message: textToSend,
          language: selectedLanguage,
          feature: 'customer-support',
          module: 'customer-support',
          ticket_id: activeTicket?.id,
          input_mode: inputMode,
          visual_context: visualPayload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: Message = {
          id: Math.random().toString(36).slice(2),
          conversation_id: currentConvId || 'support_session',
          role: 'assistant',
          content: data.response || 'I am here to assist with your inquiry.',
          created_at: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);

        // Sync active ticket if auto-created or returned
        if (data.ticket && (!activeTicket || activeTicket.id !== data.ticket.id)) {
          setActiveTicket(data.ticket);
        }

        // Voice response if dictated
        if (inputMode === 'voice') {
          const textToSpeak = data.clean_voice_response || data.response;
          if (textToSpeak && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            const speechLocale = getSpeechLocaleForText(textToSpeak, selectedLanguage);
            utterance.lang = speechLocale;
            const voices = window.speechSynthesis.getVoices();
            const targetPrefix = speechLocale.split('-')[0].toLowerCase();
            const matchingVoice = voices.find((v) =>
              v.lang.toLowerCase().replace('_', '-').startsWith(speechLocale.toLowerCase()) ||
              v.lang.toLowerCase().startsWith(targetPrefix)
            );
            if (matchingVoice) {
              utterance.voice = matchingVoice;
            }
            window.speechSynthesis.speak(utterance);
          }
        }
      } else {
        setErrorMessage('Failed to send message. Please check the backend connection.');
      }
    } catch (e: any) {
      console.error('Failed to send support chat message:', e);
      setErrorMessage(e.message || 'Error communicating with support service.');
    } finally {
      setIsSendingChat(false);
    }
  };

  const toggleDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isDictating) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      setIsDictating(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const langInfo = getLanguageInfo(selectedLanguage);
      recognition.lang = langInfo.speechCode || 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsDictating(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) {
          handleSendChatMessage(transcript.trim(), 'voice');
        }
      };

      recognition.onerror = () => {
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start dictation:', err);
      setIsDictating(false);
    }
  };

  // Render Completed Support Summary Dashboard
  if (summaryData) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
        <ConversationHeader
          title={t('support.title', 'Customer Support Workspace')}
          subtitle={summaryData.ticket_id ? `Ticket ${summaryData.ticket_id} • Resolution Logged` : 'Support Session Complete'}
          onBack={onBack}
          language={selectedLanguage}
          showHeadphoneBanner={false}
          activeFeatureId="customer-support"
          onSelectFeature={onSelectFeature}
          onNewConversation={handleRestart}
        />
        <SupportResultDashboard
          summaryData={summaryData}
          language={selectedLanguage}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      <ConversationHeader
        title={t('support.title', 'Customer Support Workspace')}
        subtitle={t('support.subtitle', 'Empathetic spoken voice customer care & support ticketing')}
        onBack={onBack}
        language={selectedLanguage}
        showHeadphoneBanner={false}
        activeFeatureId="customer-support"
        onSelectFeature={onSelectFeature}
        onNewConversation={handleRestart}
      />

      {/* Summarizing Loading Overlay */}
      {isSummarizing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <h2 className="text-xl font-bold text-white">
            Summarizing Support Session & Syncing Tickets...
          </h2>
          <p className="text-sm text-slate-300 dark:text-slate-400 max-w-md">
            Analyzing dialogue, logging issue resolution, and generating ticket summary in {getLanguageInfo(selectedLanguage).name}.
          </p>
        </div>
      )}

      {/* Tickets Manager Drawer / Modal */}
      <SupportTicketManager
        language={selectedLanguage}
        activeTicket={activeTicket}
        onSelectActiveTicket={(t) => setActiveTicket(t)}
        isOpen={isTicketManagerOpen}
        onClose={() => setIsTicketManagerOpen(false)}
      />

      {/* Workspace Subheader: Tickets Banner & Actions */}
      <div className="w-full bg-white/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Active Ticket Context Pill & New Inquiry Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTicketManagerOpen(true)}
            className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300 dark:border-slate-700 shadow-sm"
          >
            <Ticket size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>{t('support.tickets', 'Support Tickets')}</span>
          </button>

          {activeTicket ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
              <Sparkles size={12} />
              <span className="font-semibold">{activeTicket.ticket_number}:</span>
              <span className="max-w-[200px] truncate">{activeTicket.subject}</span>
              <button
                onClick={() => setActiveTicket(null)}
                title="Clear ticket context"
                className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>
          ) : (
            <span className="text-slate-500 dark:text-slate-400 text-[11px] hidden sm:inline">
              No ticket selected. A new ticket will be created automatically when you ask your question.
            </span>
          )}

          <button
            onClick={handleRestart}
            title="Start a fresh support inquiry"
            className="ml-2 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-[11px] flex items-center gap-1 transition-colors cursor-pointer border border-slate-300 dark:border-slate-700/60"
          >
            <Plus size={12} className="text-emerald-600 dark:text-emerald-400" />
            <span>New Inquiry</span>
          </button>
        </div>

        {/* Right subheader: language + support badge */}
        <div className="flex items-center gap-3">
          {onSelectLanguage && (
            <div className="flex items-center gap-1">
              <Globe size={13} className="text-slate-500 dark:text-slate-400" />
              <select
                value={selectedLanguage}
                onChange={(e) => onSelectLanguage(e.target.value as SupportedLanguage)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <MessageSquare size={12} />
            <span>Customer Care</span>
          </span>
        </div>
      </div>

      {/* Non-blocking Media Notice Alert */}
      {mediaNotice && (
        <div className="w-full max-w-4xl mx-auto px-4 mt-2">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />
              <span>{mediaNotice}</span>
            </div>
            <button
              onClick={() => setMediaNotice(null)}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-white cursor-pointer px-1"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area: Clean Customer Support Chat with Media Docks */}
      <div className="flex-1 flex flex-col h-full max-w-4xl mx-auto w-full p-4 overflow-hidden">
        {/* Compact Live Previews Dock (Camera & Screen Share) */}
        {(camera.isActive || screenShare.isSharing) && (
          <div className="mb-3 flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-lg">
            {/* Live Camera Preview */}
            {camera.isActive && (
              <div className="relative w-48 h-32 rounded-xl overflow-hidden bg-slate-950 border border-emerald-500/40 shadow-inner group shrink-0">
                <video
                  ref={camera.videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-sm border border-emerald-500/40 text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Camera Live</span>
                </div>
                <button
                  onClick={camera.stopCamera}
                  title="Camera Off"
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X size={12} />
                  <span>Off</span>
                </button>
              </div>
            )}

            {/* Live Screen Share Preview */}
            {screenShare.isSharing && (
              <div className="relative w-56 h-32 rounded-xl overflow-hidden bg-slate-950 border border-indigo-500/40 shadow-inner group shrink-0">
                <video
                  ref={screenShare.videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-sm border border-indigo-500/40 text-[10px] font-semibold text-indigo-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span>Screen Sharing Active</span>
                </div>
                <button
                  onClick={screenShare.stopScreenShare}
                  title="Stop Sharing Screen"
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X size={12} />
                  <span>Stop</span>
                </button>
              </div>
            )}

            <div className="text-[11px] text-slate-600 dark:text-slate-400 flex-1 leading-relaxed">
              <span className="text-slate-900 dark:text-slate-200 font-semibold">Active Visual Media:</span> When you send a message, current visual frames are captured for the support assistant.
            </div>
          </div>
        )}

        {/* Chat Messages Container */}
        <div className="flex-1 overflow-y-auto space-y-3 p-4 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
              <MessageSquare size={36} className="text-emerald-500/40" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">AI Customer Care Chat</h3>
              <p className="text-xs max-w-sm text-slate-500 dark:text-slate-400">
                {activeTicket
                  ? `You are discussing Ticket #${activeTicket.ticket_number}: ${activeTicket.subject}. Type or dictate your inquiry below.`
                  : 'Ask any questions regarding technical issues, hardware problems, or account support. You can type, speak with microphone, enable camera, or share your screen.'}
              </p>
            </div>
          ) : (
            chatMessages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col max-w-[80%] ${
                  m.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-md'
                  }`}
                >
                  {m.content}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {new Date(m.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
          {isSendingChat && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 italic p-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span>Customer Care agent is responding...</span>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="my-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500 dark:text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {chatMessages.length > 0 && (
          <div className="flex justify-end mt-2">
            <button
              onClick={handleEndChatSession}
              className="px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-emerald-500/50 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Check size={13} className="text-emerald-500 dark:text-emerald-400" />
              <span>Complete Inquiry & View Summary</span>
            </button>
          </div>
        )}

        {/* Media Controls Bar: [🎤 Voice] [📷 Camera] [🖥 Share Screen] */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Microphone Dictate Button */}
          <button
            type="button"
            onClick={toggleDictation}
            title={isDictating ? 'Stop Speaking' : 'Dictate question (AI responds in voice)'}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              isDictating
                ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/40 border-rose-500'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 shadow-sm'
            }`}
          >
            {isDictating ? <MicOff size={14} /> : <Mic size={14} className="text-emerald-600 dark:text-emerald-400" />}
            <span>{isDictating ? 'Listening...' : 'Voice'}</span>
          </button>

          {/* Camera Button */}
          <button
            type="button"
            onClick={handleToggleCamera}
            title={camera.isActive ? 'Turn Camera Off' : 'Turn Camera On'}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              camera.isActive
                ? 'bg-emerald-600/30 text-emerald-800 dark:text-emerald-300 border-emerald-500/50 shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 shadow-sm'
            }`}
          >
            {camera.isActive ? <CameraOff size={14} /> : <Camera size={14} className="text-emerald-600 dark:text-emerald-400" />}
            <span>{camera.isActive ? 'Camera On' : 'Camera'}</span>
          </button>

          {/* Share Screen Button */}
          <button
            type="button"
            onClick={handleToggleScreenShare}
            title={screenShare.isSharing ? 'Stop Screen Sharing' : 'Share Screen'}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              screenShare.isSharing
                ? 'bg-indigo-600/30 text-indigo-800 dark:text-indigo-300 border-indigo-500/50 shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/50 shadow-sm'
            }`}
          >
            <Monitor size={14} className={screenShare.isSharing ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'} />
            <span>{screenShare.isSharing ? 'Sharing Active' : 'Share Screen'}</span>
          </button>
        </div>

        {/* Chat Input Bar */}
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendChatMessage(undefined, 'text');
            }}
            placeholder={
              activeTicket
                ? `Message support regarding ${activeTicket.ticket_number}...`
                : 'Type or dictate your customer support question...'
            }
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
          />
          <button
            disabled={isSendingChat || !inputText.trim()}
            onClick={() => handleSendChatMessage(undefined, 'text')}
            className="p-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-all shadow-md cursor-pointer"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
