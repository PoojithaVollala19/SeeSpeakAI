import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ConversationHeader } from '../components/ConversationHeader';
import { MultimodalChat } from '../components/MultimodalChat';
import { getFeatureConfig } from '../config/features';
import { getLanguageInfo, getSpeechLocaleForText, detectTextLanguage } from '../config/languages';
import { cleanForSpeechOutput } from '../utils/textCleaning';
import { Conversation, Message, ConversationFile, SupportedLanguage } from '../types';
import { authFetch } from '../utils/authFetch';

interface FeatureWorkspaceProps {
  featureId: string;
  conversationId?: string;
  selectedLanguage: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  onBack: () => void;
  onNewConversation: () => void;
  onSelectFeature?: (route: string) => void;
  onConversationCreated?: (conv: Conversation) => void;
  initialPrompt?: string;
}

export const FeatureWorkspace: React.FC<FeatureWorkspaceProps> = ({
  featureId,
  conversationId,
  selectedLanguage,
  onSelectLanguage,
  onBack,
  onNewConversation,
  onSelectFeature,
  onConversationCreated,
  initialPrompt,
}) => {
  const feature = getFeatureConfig(featureId);
  const [activeConvId, setActiveConvId] = useState<string | undefined>(conversationId);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<ConversationFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const prevFeatureRef = useRef<string>(featureId);

  // Load existing conversation data strictly scoped to this feature
  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const res = await authFetch(`/api/conversations/${id}`);
        if (res.ok) {
          const data: Conversation = await res.json();
          // STRICT CONTEXT ISOLATION CHECK:
          // Ensure conversation belongs to this feature or alias
          const normDataFeat = data.feature.toLowerCase().replace('feature/', '');
          const normCurrentFeat = feature.id.toLowerCase().replace('feature/', '');

          if (normDataFeat !== normCurrentFeat && !feature.aliases?.includes(normDataFeat)) {
            // Context mismatch detected! Reset to clean state for this feature
            setConversation(null);
            setMessages([]);
            setAttachedFiles([]);
            setActiveConvId(undefined);
            return;
          }

          setConversation(data);
          setMessages(data.messages || []);
          setAttachedFiles(data.files || []);
        }
      } catch (err) {
        console.error('Failed to load conversation:', err);
      }
    },
    [feature]
  );

  // When featureId changes or conversationId changes:
  useEffect(() => {
    // If feature changed, completely clear previous messages & files
    if (prevFeatureRef.current !== featureId) {
      prevFeatureRef.current = featureId;
      setConversation(null);
      setMessages([]);
      setAttachedFiles([]);
      setStreamingText('');
      setError(null);
    }

    setActiveConvId(conversationId);
    if (conversationId) {
      loadConversation(conversationId);
    } else {
      setConversation(null);
      setMessages([]);
      setAttachedFiles([]);
    }
  }, [featureId, conversationId, loadConversation]);

  // Handle File Upload strictly attached to THIS feature & conversation
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (activeConvId) {
        formData.append('conversation_id', activeConvId);
      }
      formData.append('feature', feature.id);
      formData.append('language', selectedLanguage);

      const res = await authFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = `Upload failed (${res.status}): ${res.statusText}`;
        try {
          const errData = await res.json();
          if (errData.detail) errorMsg = errData.detail;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const fileRecord = await res.json();
      const convId = fileRecord.conversation_id;

      if (!activeConvId && convId) {
        setActiveConvId(convId);
        if (onConversationCreated) {
          const convRes = await authFetch(`/api/conversations/${convId}`);
          if (convRes.ok) {
            const newConv = await convRes.json();
            onConversationCreated(newConv);
          }
        }
      }

      // Refresh files for this conversation
      if (convId) {
        await loadConversation(convId);
      }
    } catch (err: any) {
      setError(err.message || 'Error uploading file');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle removing a file from the workspace
  const handleRemoveFile = async (fileId: string) => {
    try {
      const res = await authFetch(`/api/upload/${fileId}`, { method: 'DELETE' });
      if (res.ok) {
        setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
        if (activeConvId) {
          await loadConversation(activeConvId);
        }
      }
    } catch (err: any) {
      console.error('Failed to delete file:', err);
      setError(err.message || 'Failed to remove file');
    }
  };

  // Cancel speech synthesis when unmounting or switching features
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [featureId]);

  // Handle Send Message with strict feature scope and inputMode routing
  const handleSendMessage = async (text: string, inputMode: 'text' | 'voice' = 'text') => {
    setIsLoading(true);
    setError(null);
    setStreamingText('');

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp_${Date.now()}`,
      conversation_id: activeConvId || '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      let currentId = activeConvId;
      // If no conversation exists yet for this feature, create one now
      if (!currentId) {
        const createRes = await authFetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feature: feature.id,
            language: selectedLanguage,
            title: text.slice(0, 40),
          }),
        });
        if (createRes.ok) {
          const newConv: Conversation = await createRes.json();
          currentId = newConv.id;
          setActiveConvId(currentId);
          if (onConversationCreated) onConversationCreated(newConv);
        }
      }

      // Stream response strictly from backend with feature scope and inputMode
      const res = await authFetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: currentId,
          message: text,
          language: selectedLanguage,
          feature: feature.id,
          module: feature.id,
          input_mode: inputMode,
          user_prompt: text,
        }),
      });

      if (!res.ok) {
        let errorMsg = `Chat error (${res.status}): ${res.statusText}`;
        try {
          const errData = await res.json();
          if (errData.detail) errorMsg = errData.detail;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let cleanVoiceResponse = '';
      let returnedLanguage = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkStr = decoder.decode(value);
          const lines = chunkStr.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.text && !parsed.done) {
                  accumulated += parsed.text;
                  setStreamingText(accumulated);
                }
                if (parsed.clean_voice_response) {
                  cleanVoiceResponse = parsed.clean_voice_response;
                }
                if (parsed.language) {
                  returnedLanguage = parsed.language;
                }
              } catch (_) {}
            }
          }
        }
      }

      // If user explicitly typed in a native script (e.g. Telugu, Hindi) different from current selection,
      // update active selection to match their explicit script input
      const typedScript = detectTextLanguage(text);
      if (typedScript && typedScript !== selectedLanguage) {
        onSelectLanguage(typedScript as SupportedLanguage);
      }

      // STRICT INPUT-MODE ROUTING:
      // If dictated/voice input mode: SPEAK response aloud using speech synthesis.
      // If text typed input mode: DO NOT speak response aloud (display text only).
      if (inputMode === 'voice') {
        const textToSpeak = cleanVoiceResponse || cleanForSpeechOutput(accumulated);
        if (textToSpeak && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          const activeSpeechLang = typedScript || selectedLanguage;
          const speechLocale = getSpeechLocaleForText(textToSpeak, activeSpeechLang);
          utterance.lang = speechLocale;
          // Pick best matching voice for speechLocale if available
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

      // Reload updated messages from database
      if (currentId) {
        await loadConversation(currentId);
      }
    } catch (err: any) {
      setError(err.message || 'Error processing request');
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  };

  // If initialPrompt provided from Quick Starters, execute once
  useEffect(() => {
    if (initialPrompt && messages.length === 0 && !isLoading) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      <ConversationHeader
        title={feature.title}
        subtitle={conversation?.title || feature.tagline}
        onBack={onBack}
        onNewConversation={onNewConversation}
        language={selectedLanguage}
        activeFeatureId={feature.id}
        onSelectFeature={onSelectFeature}
      />

      <MultimodalChat
        conversation={conversation}
        messages={messages}
        attachedFiles={attachedFiles}
        onSendMessage={handleSendMessage}
        onFileUpload={handleFileUpload}
        onRemoveFile={handleRemoveFile}
        selectedLanguage={selectedLanguage}
        onSelectLanguage={onSelectLanguage}
        isLoading={isLoading}
        streamingText={streamingText}
        error={error}
        featureId={feature.id}
        featureTitle={feature.title}
        featureDescription={feature.description}
        samplePrompts={feature.samplePrompts}
      />
    </div>
  );
};
