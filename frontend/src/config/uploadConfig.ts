export interface ModuleUploadConfig {
  featureId: string;
  title: string;
  hint: string;
  allowedExtensions: string[];
  accept: string;
  iconName: 'FileText' | 'Image' | 'Video' | 'Music' | 'BarChart3';
}

export const MODULE_UPLOAD_CONFIGS: Record<string, ModuleUploadConfig> = {
  'document-analysis': {
    featureId: 'document-analysis',
    title: 'Upload documents',
    hint: 'PDF, DOCX, TXT supported',
    allowedExtensions: ['.pdf', '.docx', '.doc', '.txt', '.md'],
    accept: '.pdf,.docx,.doc,.txt,.md,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    iconName: 'FileText',
  },
  'visual-intelligence': {
    featureId: 'visual-intelligence',
    title: 'Upload an image',
    hint: 'JPG, PNG, WEBP supported',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.svg'],
    accept: '.jpg,.jpeg,.png,.webp,.svg,image/*',
    iconName: 'Image',
  },
  'video-audio-review': {
    featureId: 'video-audio-review',
    title: 'Upload media file',
    hint: 'MP4, MOV, WEBM, MP3, WAV, M4A supported',
    allowedExtensions: ['.mp4', '.mov', '.webm', '.mp3', '.wav', '.m4a', '.ogg'],
    accept: '.mp4,.mov,.webm,.mp3,.wav,.m4a,.ogg,video/*,audio/*',
    iconName: 'Video',
  },
  'data-study': {
    featureId: 'data-study',
    title: 'Upload dataset or study materials',
    hint: 'CSV, XLSX, JSON, PDF, TXT supported',
    allowedExtensions: ['.csv', '.xlsx', '.xls', '.json', '.pdf', '.txt', '.docx'],
    accept: '.csv,.xlsx,.xls,.json,.pdf,.txt,.docx,text/csv,application/json,application/pdf',
    iconName: 'BarChart3',
  },
};

export function getUploadConfig(featureId?: string): ModuleUploadConfig {
  if (!featureId) return MODULE_UPLOAD_CONFIGS['document-analysis'];
  const clean = featureId.toLowerCase().replace('feature/', '').trim();
  if (clean.includes('doc')) return MODULE_UPLOAD_CONFIGS['document-analysis'];
  if (clean.includes('vis') || clean.includes('image')) return MODULE_UPLOAD_CONFIGS['visual-intelligence'];
  if (clean.includes('video') || clean.includes('audio') || clean.includes('media') || clean.includes('meet')) {
    return MODULE_UPLOAD_CONFIGS['video-audio-review'];
  }
  if (clean.includes('data') || clean.includes('study')) return MODULE_UPLOAD_CONFIGS['data-study'];
  return MODULE_UPLOAD_CONFIGS[clean] || MODULE_UPLOAD_CONFIGS['document-analysis'];
}
