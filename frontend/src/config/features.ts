import { FeatureConfig } from '../types';

export const FEATURES: FeatureConfig[] = [
  {
    id: 'document-analysis',
    title: 'Document Analysis',
    tagline: 'Deep PDF & Document Grounding',
    description: 'Extract key points, chapter summaries, exam questions, and comparative analysis from complex PDFs and documents.',
    route: '/document-analysis',
    aliases: ['document', 'feature/document'],
    iconName: 'FileText',
    colorScheme: {
      bg: 'from-blue-600/15 via-blue-900/10 to-transparent',
      border: 'border-blue-500/20 hover:border-blue-400/50',
      text: 'text-blue-400',
      glow: 'shadow-blue-500/10',
      accent: '#3b82f6',
    },
    supportedMimeTypes: [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    samplePrompts: [
      { text: 'Summarize the core takeaways from this document', langHint: '📄 Summary' },
      { text: 'Explain the main concepts in Telugu', langHint: '🇮🇳 Telugu' },
      { text: 'Generate 5 technical exam questions with answers', langHint: '🎓 Exam Prep' },
      { text: 'Compare section 1 with section 3', langHint: '🔬 Compare' },
    ],
  },
  {
    id: 'visual-intelligence',
    title: 'Visual Intelligence',
    tagline: 'Diagrams, OCR & Error Screenshots',
    description: 'Analyze system architecture diagrams, debug error screenshots, extract handwritten notes, and inspect visual UI components.',
    route: '/visual-intelligence',
    aliases: ['vision', 'feature/vision'],
    iconName: 'Image',
    colorScheme: {
      bg: 'from-purple-600/15 via-purple-900/10 to-transparent',
      border: 'border-purple-500/20 hover:border-purple-400/50',
      text: 'text-purple-400',
      glow: 'shadow-purple-500/10',
      accent: '#a855f7',
    },
    supportedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    samplePrompts: [
      { text: 'Explain what this system architecture diagram does step-by-step', langHint: '👁️ Vision' },
      { text: 'Debug this code screenshot error and show the exact code fix', langHint: '💻 Debug' },
      { text: 'Extract and transcribe all text from this image', langHint: '📝 OCR' },
      { text: 'Explain this diagram in Kannada', langHint: '🇮🇳 Kannada' },
    ],
  },
  {
    id: 'ai-interview',
    title: 'AI Interview Practice',
    tagline: 'Real-Time Spoken Mock Interviews',
    description: 'Engage in realistic spoken interviews with live low-latency speech, natural barge-in interruptions, and instant feedback.',
    route: '/ai-interview',
    aliases: ['interview'],
    iconName: 'Mic',
    colorScheme: {
      bg: 'from-rose-600/15 via-rose-900/10 to-transparent',
      border: 'border-rose-500/20 hover:border-rose-400/50',
      text: 'text-rose-400',
      glow: 'shadow-rose-500/10',
      accent: '#f43f5e',
    },
    supportedMimeTypes: [],
    samplePrompts: [
      { text: 'Start Software Engineer Behavioral Interview', langHint: '🎤 Live Voice' },
      { text: 'Ask me System Design questions', langHint: '🎤 Voice' },
      { text: 'Practice Frontend React interview', langHint: '🎤 Spoken' },
    ],
  },
  {
    id: 'customer-support',
    title: 'Customer Support Agent',
    tagline: 'Empathetic Spoken Voice Service',
    description: 'Experience an empathetic, spoken customer support agent ready to solve order inquiries, clarify technical problems, and assist in real-time.',
    route: '/customer-support',
    aliases: ['support', 'customer-service', 'service'],
    iconName: 'Headphones',
    colorScheme: {
      bg: 'from-emerald-600/15 via-emerald-900/10 to-transparent',
      border: 'border-emerald-500/20 hover:border-emerald-400/50',
      text: 'text-emerald-400',
      glow: 'shadow-emerald-500/10',
      accent: '#10b981',
    },
    supportedMimeTypes: [],
    samplePrompts: [
      { text: 'Hello, I have an inquiry about my recent service subscription', langHint: '🎧 Support' },
      { text: 'I need help troubleshooting an account issue', langHint: '🎧 Voice' },
    ],
  },
  {
    id: 'video-audio-review',
    title: 'Video & Audio Review',
    tagline: 'Media Insights & Discussion Review',
    description: 'Upload lecture recordings, meeting audio, and media files to transcribe, summarize discussions, and find action items.',
    route: '/video-audio-review',
    aliases: ['meeting', 'feature/meeting'],
    iconName: 'Video',
    colorScheme: {
      bg: 'from-amber-600/15 via-amber-900/10 to-transparent',
      border: 'border-amber-500/20 hover:border-amber-400/50',
      text: 'text-amber-400',
      glow: 'shadow-amber-500/10',
      accent: '#f59e0b',
    },
    supportedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'video/mp4', 'video/quicktime', 'video/webm'],
    samplePrompts: [
      { text: 'Summarize the key decisions and action items in this recording', langHint: '🎬 Media' },
      { text: 'Highlight technical talking points in Marathi', langHint: '🇮🇳 Marathi' },
      { text: 'Generate an executive bullet point meeting summary', langHint: '⚡ Notes' },
    ],
  },
  {
    id: 'data-study',
    title: 'Data & Study Assistant',
    tagline: 'Spreadsheets, Tables & Tutoring',
    description: 'Analyze CSV spreadsheets, financial tables, academic notes, and code repositories with step-by-step multilingual explanations.',
    route: '/data-study',
    aliases: ['study', 'feature/study'],
    iconName: 'BarChart3',
    colorScheme: {
      bg: 'from-indigo-600/15 via-indigo-900/10 to-transparent',
      border: 'border-indigo-500/20 hover:border-indigo-400/50',
      text: 'text-indigo-400',
      glow: 'shadow-indigo-500/10',
      accent: '#6366f1',
    },
    supportedMimeTypes: [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'text/plain'
    ],
    samplePrompts: [
      { text: 'Analyze trends and summarize the top performers in this dataset', langHint: '📊 Data' },
      { text: 'Explain the mathematical intuition behind this algorithm in Hindi', langHint: '🇮🇳 Hindi' },
      { text: 'Generate a clean table breakdown of the metrics', langHint: '📈 Tables' },
    ],
  },
];

export function getFeatureConfig(idOrRoute: string): FeatureConfig {
  if (!idOrRoute) return FEATURES[0];
  const clean = idOrRoute.replace(/^\//, '').replace(/\/c\/.*$/, '').toLowerCase().trim();
  const found = FEATURES.find(
    (f) =>
      f.id === clean ||
      f.route.replace(/^\//, '') === clean ||
      (f.aliases && f.aliases.includes(clean))
  );
  return found || FEATURES[0];
}
