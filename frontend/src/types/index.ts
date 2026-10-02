export type SupportedLanguage = 
  | 'auto' 
  | 'en' 
  | 'te' 
  | 'hi' 
  | 'kn' 
  | 'mr' 
  | 'ta' 
  | 'ml' 
  | 'bn' 
  | 'gu' 
  | 'pa' 
  | 'ur'
  | 'es'
  | 'fr'
  | 'de'
  | 'ja'
  | 'ko'
  | 'zh';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  speechCode: string;
  promptInstruction: string;
}

export interface TranscriptTurn {
  speaker: 'ai' | 'user';
  text: string;
  timestamp: string;
  language?: string;
}

export interface ExperienceMetrics {
  interruptions: number;
  duration_seconds: number;
  camera_used: boolean;
  screen_share_used: boolean;
  speaking_activity_user_pct?: number;
  speaking_activity_ai_pct?: number;
  avg_response_latency_ms?: number;
}

export interface QuestionAnalysis {
  question: string;
  answer: string;
  evaluation: string;
  score?: number;
  strengths?: string;
  improvements?: string;
}

export interface PerformanceMetrics {
  communication: number;
  clarity: number;
  relevance: number;
  technical_knowledge: number;
  problem_solving: number;
  completeness: number;
  consistency: number;
  engagement: number;
}

export interface InterviewEvaluation {
  overall_score: number;
  evaluation_method: string;
  performance_metrics: PerformanceMetrics;
  strengths: string[];
  areas_for_improvement: string[];
  recommendations: string[];
  question_analysis: QuestionAnalysis[];
}

export interface InterviewSessionData {
  id: string;
  user_id: string;
  interview_type: string;
  language: SupportedLanguage;
  started_at: string;
  completed_at?: string;
  duration_seconds: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  transcript: TranscriptTurn[];
  questions?: string[];
  answers?: string[];
  evaluation?: InterviewEvaluation;
  experience_metrics?: ExperienceMetrics;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  subject: string;
  description: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'In Progress' | 'Waiting for Customer' | 'Resolved' | 'Closed';
  language: string;
  conversation_id?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  message_count?: number;
  messages?: TicketMessage[];
  summary?: any;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: 'user' | 'agent' | 'system';
  message: string;
  timestamp: string;
}

export interface ConversationFile {
  id: string;
  conversation_id: string;
  filename: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  url?: string;
  page_count?: number;
  row_count?: number;
  status?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  feature: string;
  mode: string;
  language: SupportedLanguage;
  is_favorite?: boolean;
  created_at: string;
  updated_at: string;
  messages?: Message[];
  files?: ConversationFile[];
  file_count?: number;
  ticket_id?: string;
  ticket?: SupportTicket;
  summary?: any;
}

export type VoiceSessionMode = 'interviewer' | 'customer_service';

export type InterviewState =
  | 'idle'
  | 'connecting'
  | 'ai_speaking'
  | 'waiting_for_candidate'
  | 'candidate_speaking'
  | 'processing_answer'
  | 'ending'
  | 'ended'
  | 'error';

export interface InterviewMessage {
  id: string;
  role: 'interviewer' | 'candidate';
  text: string;
  timestamp: number;
  status: 'streaming' | 'final';
}

export type VoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'interrupted'
  | 'error'
  | InterviewState;

export interface RealtimeServerEvent {
  type: 
    | 'session_ready' 
    | 'user_speaking' 
    | 'agent_speaking' 
    | 'turn_complete' 
    | 'interrupt' 
    | 'latency' 
    | 'transcript' 
    | 'internal_event'
    | 'error';
  session_id?: string;
  mode?: string;
  sample_rate?: number;
  voice_mode?: string;
  latency?: number;
  latency_ms?: number;
  role?: 'user' | 'agent';
  text?: string;
  is_final?: boolean;
  message?: string;
  event_name?: string;
  data?: any;
}

export interface FeatureConfig {
  id: string;
  title: string;
  tagline: string;
  description: string;
  route: string;
  aliases?: string[];
  iconName: string;
  colorScheme: {
    bg: string;
    border: string;
    text: string;
    glow: string;
    accent: string;
  };
  supportedMimeTypes: string[];
  samplePrompts: { text: string; langHint: string }[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  created_at?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

