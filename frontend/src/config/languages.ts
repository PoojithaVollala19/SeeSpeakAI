import { LanguageInfo, SupportedLanguage } from '../types';

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    speechCode: 'en-US',
    promptInstruction: 'Respond in clear, natural, modern English.',
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    flag: '🇮🇳',
    speechCode: 'te-IN',
    promptInstruction: 'Respond naturally in fluent Telugu (తెలుగు). Use Telugu script. Keep code and technical terms in English while explaining thoroughly in Telugu.',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    speechCode: 'hi-IN',
    promptInstruction: 'Respond naturally in fluent Hindi (हिन्दी). Use Devanagari script. Keep programming syntax and technical jargon in English, explaining concepts conversationally in Hindi.',
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    flag: '🇮🇳',
    speechCode: 'kn-IN',
    promptInstruction: 'Respond naturally in Kannada (ಕನ್ನಡ). Use Kannada script. Do not translate into English or Hindi unless explicitly requested. Preserve code and technical terms.',
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    flag: '🇮🇳',
    speechCode: 'mr-IN',
    promptInstruction: 'Respond naturally in Marathi (मराठी). Use Devanagari script. Do not default to Hindi or English. Preserve code and technical terms.',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🇮🇳',
    speechCode: 'ta-IN',
    promptInstruction: 'Respond naturally in fluent Tamil (தமிழ்). Use Tamil script. Keep code and technical terms in English while explaining concepts in Tamil.',
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    flag: '🇮🇳',
    speechCode: 'ml-IN',
    promptInstruction: 'Respond naturally in fluent Malayalam (മലയാളം). Use Malayalam script. Preserve code and technical terms in English while explaining in Malayalam.',
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    flag: '🇮🇳',
    speechCode: 'bn-IN',
    promptInstruction: 'Respond naturally in fluent Bengali (বাংলা). Use Bengali script. Retain code and technical terms in English while explaining in Bengali.',
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    flag: '🇮🇳',
    speechCode: 'gu-IN',
    promptInstruction: 'Respond naturally in fluent Gujarati (ગુજરાતી). Use Gujarati script. Keep technical terms and code in English while explaining in Gujarati.',
  },
  {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    flag: '🇮🇳',
    speechCode: 'pa-IN',
    promptInstruction: 'Respond naturally in fluent Punjabi (ਪੰਜਾਬੀ). Use Gurmukhi script. Retain technical terms in English, explaining concepts in Punjabi.',
  },
  {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    flag: '🇵🇰',
    speechCode: 'ur-IN',
    promptInstruction: 'Respond naturally in fluent Urdu (اردو). Use Urdu script. Keep technical terms and code in English while providing Urdu explanations.',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    speechCode: 'es-ES',
    promptInstruction: 'Respond naturally in fluent Spanish (Español). Keep technical terms and programming code in original English without translating syntax.',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    speechCode: 'fr-FR',
    promptInstruction: 'Respond naturally in fluent French (Français). Preserve programming code and technical terminology in English.',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    speechCode: 'de-DE',
    promptInstruction: 'Respond naturally in fluent German (Deutsch). Retain code, syntax, and standard technical terms in English.',
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    speechCode: 'ja-JP',
    promptInstruction: 'Respond naturally in fluent Japanese (日本語). Use appropriate politeness (Desu/Masu). Keep code and programming terminology in English.',
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    speechCode: 'ko-KR',
    promptInstruction: 'Respond naturally in fluent Korean (한국어). Use polite speech (Haeyo-che). Keep code and technical terms intact in English.',
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '简体中文',
    flag: '🇨🇳',
    speechCode: 'zh-CN',
    promptInstruction: 'Respond naturally in fluent Simplified Chinese (简体中文). Keep code and programming syntax in original English.',
  },
];

export function getLanguageInfo(code: string): LanguageInfo {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code) || SUPPORTED_LANGUAGES[0];
}

export function detectTextLanguage(text: string): string | null {
  if (!text || !text.trim()) return null;
  const counts: Record<string, number> = {
    te: 0, hi: 0, ta: 0, kn: 0, ml: 0, bn: 0, gu: 0, pa: 0, ur: 0, ja: 0, ko: 0, zh: 0, latin: 0
  };
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0C00 && code <= 0x0C7F) counts.te++;
    else if (code >= 0x0900 && code <= 0x097F) counts.hi++;
    else if (code >= 0x0B80 && code <= 0x0BFF) counts.ta++;
    else if (code >= 0x0C80 && code <= 0x0CFF) counts.kn++;
    else if (code >= 0x0D00 && code <= 0x0D7F) counts.ml++;
    else if (code >= 0x0980 && code <= 0x09FF) counts.bn++;
    else if (code >= 0x0A80 && code <= 0x0AFF) counts.gu++;
    else if (code >= 0x0A00 && code <= 0x0A7F) counts.pa++;
    else if (code >= 0x0600 && code <= 0x06FF) counts.ur++;
    else if (code >= 0x3040 && code <= 0x30FF) counts.ja++;
    else if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF)) counts.ko++;
    else if (code >= 0x4E00 && code <= 0x9FFF) counts.zh++;
    else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) counts.latin++;
  }
  let bestLang: string | null = null;
  let bestCount = 0;
  for (const [lang, count] of Object.entries(counts)) {
    if (lang === 'latin') continue;
    if (count > bestCount) {
      bestCount = count;
      bestLang = lang;
    }
  }
  if (bestCount >= 2 || (bestCount > 0 && counts.latin === 0)) {
    if (bestLang === 'hi') {
      const marathiIndicators = ["आहे", "नाही", "करा", "काय", "झाले", "कसे", "मला", "आपण", "होते", "आणि"];
      if (marathiIndicators.some(w => text.includes(w))) return 'mr';
    }
    return bestLang;
  }
  if (counts.latin > 0) {
    const lower = ` ${text.toLowerCase()} `;
    if (/ bonjour | s'il vous plaît | merci | français | pourquoi | comment | explique /.test(lower)) {
      return 'fr';
    }
    if (/ hola | por favor | gracias | español | explica | resumen | documento | qué es /.test(lower)) {
      return 'es';
    }
    if (/ hallo | bitte | danke | deutsch | erklären | zusammenfassung /.test(lower)) {
      return 'de';
    }
    // Return null for generic Latin text so fallback user-selected language speech locale is respected
    return null;
  }
  return null;
}

export function getSpeechLocaleForText(text: string, fallbackLang: string): string {
  const detected = detectTextLanguage(text);
  if (detected) {
    const info = getLanguageInfo(detected);
    return info.speechCode || 'en-US';
  }
  const fallbackInfo = getLanguageInfo(fallbackLang);
  return fallbackInfo.speechCode || 'en-US';
}

