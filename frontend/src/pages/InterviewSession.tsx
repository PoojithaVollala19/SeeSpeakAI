import React, { useState, useRef, useEffect } from 'react';
import { VoiceOrb } from '../components/VoiceOrb';
import { LatencyBadge } from '../components/LatencyBadge';
import { ConversationHeader } from '../components/ConversationHeader';
import { MediaPreviewDock } from '../components/MediaPreviewDock';
import { InterviewResultDashboard } from '../components/InterviewResultDashboard';
import { useVoiceSession } from '../hooks/useVoiceSession';
import { useCamera } from '../hooks/useCamera';
import { useScreenShare } from '../hooks/useScreenShare';
import { useTranslation } from '../locales/i18n';
import { SUPPORTED_LANGUAGES } from '../config/languages';
import { authFetch } from '../utils/authFetch';
import {
  Play,
  Square,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Monitor,
  Copy,
  Check,
  Download,
  Briefcase,
  Loader2,
  Globe,
  Award,
  Layers,
  HelpCircle,
  FileText,
  Send,
  Sparkles,
  Sliders,
  ChevronRight,
  Upload,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { SupportedLanguage, InterviewSessionData } from '../types';

const COMMON_ROLES = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Engineer',
  'Full Stack Engineer',
  'Data Scientist / AI Engineer',
  'DevOps / Cloud Engineer',
  'System Architect',
  'Product Manager'
];

const EXPERIENCE_LEVELS = [
  'Fresher / College Graduate',
  'Junior (1-2 years)',
  'Mid-Level (3-5 years)',
  'Senior (5-8 years)',
  'Staff / Principal (8+ years)'
];

const INTERVIEW_TYPES = [
  'Technical & Coding',
  'System Design & Architecture',
  'Behavioral & Leadership',
  'Core Fundamentals & Viva',
  'HR Interview'
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

interface InterviewSessionProps {
  onBack: () => void;
  selectedLanguage: SupportedLanguage;
  onSelectLanguage?: (lang: SupportedLanguage) => void;
  onSelectFeature?: (route: string) => void;
  onNewConversation?: () => void;
}

export const InterviewSession: React.FC<InterviewSessionProps> = ({
  onBack,
  selectedLanguage,
  onSelectLanguage,
  onSelectFeature,
  onNewConversation,
}) => {
  const { t } = useTranslation(selectedLanguage);

  // Configuration State
  const [jobRole, setJobRole] = useState<string>('Software Engineer');
  const [experienceLevel, setExperienceLevel] = useState<string>(EXPERIENCE_LEVELS[0]);
  const [interviewType, setInterviewType] = useState<string>(INTERVIEW_TYPES[0]);
  const [difficulty, setDifficulty] = useState<string>('Medium');
  const [jobDescription, setJobDescription] = useState<string>('');

  // Resume Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeData, setResumeData] = useState<any | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState<boolean>(false);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);

  const handleResumeUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingResume(true);
    setResumeUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch('/api/interviews/upload-resume', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to parse resume');
      }
      const data = await res.json();
      setResumeFile(file);
      setResumeData(data.parsed);
    } catch (err: any) {
      console.error('Resume upload error:', err);
      setResumeUploadError(err.message || 'Error uploading resume. Please try a PDF, DOCX, or TXT file.');
    } finally {
      setIsUploadingResume(false);
    }
  };

  // Session Tracking
  const [interviewSessionId, setInterviewSessionId] = useState<string | null>(null);
  const [completedSessionData, setCompletedSessionData] = useState<InterviewSessionData | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState<string>('');

  // Camera & Screen Share
  const camera = useCamera();
  const screenShare = useScreenShare();

  // Real-Time Voice Session Hook with full configuration
  const {
    voiceState,
    latencyMs,
    voiceMode,
    transcripts,
    continuousTranscript,
    audioLevel,
    errorMessage,
    isConnected,
    isRecording,
    isMuted,
    interruptionCount,
    toggleMute,
    startSession,
    stopSession,
    sendTextMessage,
    sendVideoFrame,
  } = useVoiceSession({
    mode: 'ai-interview',
    language: selectedLanguage,
    interviewType: interviewType,
    interviewSessionId: interviewSessionId || undefined,
    jobRole: jobRole,
    experienceLevel: experienceLevel,
    difficulty: difficulty,
    jobDescription: jobDescription,
    resumeContext: resumeData,
  });

  const isActive = voiceState !== 'idle' && voiceState !== 'error' && voiceState !== 'ended';

  // In-memory periodic frame capture for camera / screen share
  useEffect(() => {
    if (!isActive) return;
    if (!camera.isActive && !screenShare.isSharing) return;

    const interval = setInterval(() => {
      const vid = screenShare.isSharing ? screenShare.videoRef.current : camera.videoRef.current;
      if (!vid || vid.readyState < 2) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(vid.videoWidth || 640, 640);
        canvas.height = Math.min(vid.videoHeight || 480, 480);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          const base64 = dataUrl.split(',')[1];
          if (base64) {
            sendVideoFrame(base64, 'image/jpeg');
          }
        }
      } catch (_) {}
    }, 1500);

    return () => clearInterval(interval);
  }, [isActive, camera.isActive, screenShare.isSharing, sendVideoFrame]);

  // Strict unmount isolation: when user leaves Interview page, stop all audio, mic, camera, screen, and socket immediately
  useEffect(() => {
    return () => {
      stopSession();
      camera.stopCamera();
      screenShare.stopScreenShare();
    };
  }, []);

  // Compute current question index based on AI turns
  const aiTurnsCount = continuousTranscript.filter((t) => t.speaker === 'ai').length;
  const currentQuestionIndex = Math.max(1, aiTurnsCount);

  // Create persistent session on backend when starting interview
  const handleStartInterview = async () => {
    let createdId: string | undefined = undefined;
    try {
      const res = await authFetch('/api/interviews/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interview_type: interviewType,
          job_role: jobRole,
          experience_level: experienceLevel,
          difficulty: difficulty,
          job_description: jobDescription,
          resume_context: resumeData,
          language: selectedLanguage,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        createdId = data.id;
        setInterviewSessionId(data.id);
      }
    } catch (e) {
      console.error('Failed to create interview session:', e);
    }
    setStartTime(Date.now());
    await startSession(createdId);
  };

  // End interview and generate AI evaluation dashboard
  const handleEndInterview = async () => {
    stopSession();
    camera.stopCamera();
    screenShare.stopScreenShare();

    let targetSessionId = interviewSessionId;
    if (!targetSessionId) {
      try {
        const res = await authFetch('/api/interviews/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interview_type: interviewType,
            job_role: jobRole,
            experience_level: experienceLevel,
            difficulty: difficulty,
            job_description: jobDescription,
            resume_context: resumeData,
            language: selectedLanguage,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          targetSessionId = data.id;
          setInterviewSessionId(data.id);
        }
      } catch (e) {
        console.error('Failed to create fallback interview session:', e);
      }
    }

    if (!targetSessionId) {
      alert('Unable to evaluate: interview session could not be established.');
      return;
    }

    setIsEvaluating(true);
    const durationSec = startTime ? Math.max(1, Math.round((Date.now() - startTime) / 1000)) : 60;

    const experienceMetrics = {
      interruptions: interruptionCount,
      duration_seconds: durationSec,
      camera_used: camera.isActive || !!camera.stream,
      screen_share_used: screenShare.isSharing || !!screenShare.stream,
      speaking_activity_user_pct: 45,
      speaking_activity_ai_pct: 55,
      job_role: jobRole,
      experience_level: experienceLevel,
      difficulty: difficulty,
      resume_context: resumeData,
    };

    try {
      const res = await authFetch(`/api/interviews/sessions/${targetSessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_seconds: durationSec,
          transcript: continuousTranscript,
          experience_metrics: experienceMetrics,
        }),
      });

      if (res.ok) {
        const completedData: InterviewSessionData = await res.json();
        setCompletedSessionData(completedData);
      } else {
        const errText = await res.text();
        console.error('Failed to complete interview evaluation:', errText);
        alert('Evaluation generation encountered an issue. Please try again or check the transcript.');
      }
    } catch (err) {
      console.error('Error completing interview:', err);
      alert('Network error while completing interview. Please check your connection.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRestart = () => {
    setCompletedSessionData(null);
    setInterviewSessionId(null);
    setStartTime(null);
  };

  const handleSendTypedAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typedAnswer.trim()) return;
    sendTextMessage(typedAnswer.trim());
    setTypedAnswer('');
  };

  const handleCopyTranscript = () => {
    const text = continuousTranscript
      .map((t) => `[${t.speaker.toUpperCase()} - ${new Date(t.timestamp).toLocaleTimeString()}]: ${t.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const handleExportTranscript = () => {
    const text = continuousTranscript
      .map((t) => `[${t.speaker.toUpperCase()}]: ${t.text}`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Interview_Transcript_${jobRole.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Render Completed Evaluation Dashboard
  if (completedSessionData) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
        <ConversationHeader
          title={t('interview.title', 'AI Interview Practice')}
          subtitle={`${jobRole} • Evaluation Completed`}
          onBack={onBack}
          language={selectedLanguage}
          showHeadphoneBanner={false}
          activeFeatureId="ai-interview"
          onSelectFeature={onSelectFeature}
          onNewConversation={onNewConversation}
        />
        <InterviewResultDashboard
          sessionData={completedSessionData}
          language={selectedLanguage}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      <ConversationHeader
        title={t('interview.title', 'AI Interview Practice')}
        subtitle={isActive ? `Interview in Progress: ${jobRole}` : 'Configure & launch your personalized interview'}
        onBack={onBack}
        language={selectedLanguage}
        showHeadphoneBanner={isActive}
        activeFeatureId="ai-interview"
        onSelectFeature={onSelectFeature}
        onNewConversation={onNewConversation}
      />

      {/* Evaluating Loading Overlay */}
      {isEvaluating && (
        <div className="fixed inset-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4">
          <Loader2 size={48} className="text-indigo-600 dark:text-indigo-400 animate-spin" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('interview.evaluating', 'Analyzing Interview & Generating Results...')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
            Synthesizing dialogue, scoring performance rubric, and compiling strengths and recommendations.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-4xl mx-auto w-full flex flex-col justify-between">
        {/* Top Controls Bar */}
        <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <Briefcase size={13} />
              <span>{jobRole}</span>
            </span>
            {isActive && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                Question {currentQuestionIndex} • Adaptive Pace
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {onSelectLanguage && (
              <div className="flex items-center gap-1.5">
                <Globe size={14} className="text-slate-500 dark:text-slate-400" />
                <select
                  disabled={isActive}
                  value={selectedLanguage}
                  onChange={(e) => onSelectLanguage(e.target.value as SupportedLanguage)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <LatencyBadge
              latencyMs={latencyMs}
              isConnected={isConnected}
              voiceMode={voiceMode}
            />
          </div>
        </div>

        {/* Media Preview Dock (Camera and Screen Share) */}
        <MediaPreviewDock
          isCameraActive={camera.isActive}
          cameraVideoRef={camera.videoRef}
          onStopCamera={camera.stopCamera}
          isScreenSharing={screenShare.isSharing}
          screenVideoRef={screenShare.videoRef}
          onStopScreenShare={screenShare.stopScreenShare}
        />

        {/* PRE-INTERVIEW CONFIGURATION CARD (Shown when idle) */}
        {!isActive && (
          <div className="my-auto w-full max-w-2xl mx-auto bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 animate-fadeIn transition-colors duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders size={20} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Configure Your Interview</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Dynamic, resume-grounded AI interviewer adapting in real-time.
                </p>
              </div>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                Adaptive Length
              </span>
            </div>

            {/* 1. Interview Type */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center justify-between">
                <span>1. Interview Type</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Select evaluation focus</span>
              </label>
              <select
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-750 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                {INTERVIEW_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Position / Job Role */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center justify-between">
                <span>2. Position / Target Job Role</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Role context for dynamic questions</span>
              </label>
              <input
                type="text"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                placeholder="e.g. Frontend Developer, Full Stack Engineer, Data Scientist..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-750 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none transition-colors"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {COMMON_ROLES.slice(0, 5).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setJobRole(role)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      jobRole === role
                        ? 'bg-indigo-50 dark:bg-indigo-600/30 border-indigo-400 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Experience Level & 4. Preferred Language Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 3. Experience Level */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  3. Experience Level
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-750 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Preferred Language */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <Globe size={13} className="text-indigo-600 dark:text-indigo-400" />
                  <span>4. Preferred Language</span>
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => onSelectLanguage && onSelectLanguage(e.target.value as SupportedLanguage)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-750 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. Resume Upload */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText size={14} className="text-indigo-600 dark:text-indigo-400" />
                  <span>5. Upload Resume</span>
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">PDF, DOCX, TXT</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleResumeUpload(file);
                }}
              />

              {!resumeFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleResumeUpload(file);
                  }}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                    isUploadingResume
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/5'
                      : 'border-slate-300 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-slate-100/50 dark:hover:bg-slate-950/50 bg-slate-50/70 dark:bg-slate-950'
                  }`}
                >
                  {isUploadingResume ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-2">
                      <Loader2 size={24} className="text-indigo-600 dark:text-indigo-400 animate-spin" />
                      <p className="text-xs text-indigo-600 dark:text-indigo-300 font-medium">Extracting skills, projects & experience...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-1">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                        <Upload size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          Click or drag & drop to upload your resume
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5">
                          AI dynamically personalizes questions using your actual projects & claimed experience
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5">
                        <span>Resume uploaded:</span>
                        <span className="font-mono text-slate-900 dark:text-white">{resumeFile.name} ✓</span>
                      </p>
                      {resumeData?.skills?.length > 0 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Detected {resumeData.skills.length} skills &bull; {resumeData.projects?.length || 0} projects
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>Replace</span>
                  </button>
                </div>
              )}

              {resumeUploadError && (
                <p className="text-xs text-rose-500 dark:text-rose-400 mt-1.5 flex items-center gap-1">
                  {resumeUploadError}
                </p>
              )}
            </div>

            {/* Start Interview Launch Button */}
            <button
              onClick={handleStartInterview}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
            >
              <Play size={18} />
              <span>Start {jobRole} Interview</span>
            </button>
          </div>
        )}

        {/* ACTIVE INTERVIEW ORB & CONTROLS (Shown when active) */}
        {isActive && (
          <div className="my-auto flex flex-col items-center w-full max-w-2xl mx-auto">
            {/* Active Interview Context Bar (Emphasizing Role, Experience, Track & Resume) */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6 text-xs animate-fadeIn">
              <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm">
                <Briefcase size={12} className="text-rose-600 dark:text-rose-400" />
                <span className="text-slate-500 dark:text-slate-400">Role:</span>
                <strong className="text-slate-900 dark:text-white font-medium">{jobRole}</strong>
              </span>
              <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm">
                <span className="text-slate-500 dark:text-slate-400">Level:</span>
                <strong className="text-slate-900 dark:text-white font-medium">{experienceLevel}</strong>
              </span>
              <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm">
                <span className="text-slate-500 dark:text-slate-400">Track:</span>
                <strong className="text-indigo-600 dark:text-indigo-300 font-medium">{interviewType}</strong>
              </span>
              {resumeData?.skills && resumeData.skills.length > 0 && (
                <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm">
                  <FileText size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-slate-500 dark:text-slate-400">Resume:</span>
                  <strong className="text-emerald-600 dark:text-emerald-300 font-medium">
                    {resumeData.skills.slice(0, 3).join(', ')}{resumeData.skills.length > 3 ? ` +${resumeData.skills.length - 3}` : ''}
                  </strong>
                </span>
              )}
            </div>

            <VoiceOrb
              state={voiceState}
              audioLevel={audioLevel}
              onClick={handleEndInterview}
            />

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <button
                onClick={handleEndInterview}
                className="px-6 py-2.5 rounded-full font-semibold text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer transition-all"
              >
                <Square size={16} />
                <span>{t('interview.end', 'End & Complete Interview')}</span>
              </button>

              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={`p-2.5 rounded-full border transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <button
                onClick={camera.toggleCamera}
                title={camera.isActive ? t('interview.camera_off', 'Turn Off Camera') : t('interview.camera_on', 'Enable Camera')}
                className={`p-2.5 rounded-full border transition-all cursor-pointer ${
                  camera.isActive
                    ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-600 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {camera.isActive ? <Camera size={18} /> : <CameraOff size={18} />}
              </button>

              <button
                onClick={screenShare.toggleScreenShare}
                title={screenShare.isSharing ? t('interview.screen_off', 'Stop Screen Share') : t('interview.screen_on', 'Share Screen')}
                className={`p-2.5 rounded-full border transition-all cursor-pointer ${
                  screenShare.isSharing
                    ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-600 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Monitor size={18} />
              </button>
            </div>

            {/* Quick Answer Input Bar (Optional text input while speaking) */}
            <form onSubmit={handleSendTypedAnswer} className="w-full max-w-lg mt-5 flex items-center gap-2">
              <input
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                placeholder="Or type your interview response here and press Enter..."
                className="flex-1 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-full px-4 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!typedAnswer.trim()}
                className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors cursor-pointer"
                title="Send typed answer"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
