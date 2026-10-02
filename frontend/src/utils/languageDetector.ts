import { SupportedLanguage } from '../types';

export function detectScriptLanguage(text: string): SupportedLanguage | null {
  if (!text || !text.trim()) return null;

  let te = 0, hi = 0, ta = 0, kn = 0, ml = 0, bn = 0, gu = 0, pa = 0, ur = 0, ja = 0, ko = 0, zh = 0, latin = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0c00 && code <= 0x0c7f) te++;
    else if (code >= 0x0900 && code <= 0x097f) hi++;
    else if (code >= 0x0b80 && code <= 0x0bff) ta++;
    else if (code >= 0x0c80 && code <= 0x0cff) kn++;
    else if (code >= 0x0d00 && code <= 0x0d7f) ml++;
    else if (code >= 0x0980 && code <= 0x09ff) bn++;
    else if (code >= 0x0a80 && code <= 0x0aff) gu++;
    else if (code >= 0x0a00 && code <= 0x0a7f) pa++;
    else if (code >= 0x0600 && code <= 0x06ff) ur++;
    else if (code >= 0x3040 && code <= 0x30ff) ja++;
    else if ((code >= 0xac00 && code <= 0xd7af) || (code >= 0x1100 && code <= 0x11ff)) ko++;
    else if (code >= 0x4e00 && code <= 0x9fff) zh++;
    else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) latin++;
  }

  const indicMap: [SupportedLanguage, number][] = [
    ['te', te],
    ['hi', hi],
    ['ta', ta],
    ['kn', kn],
    ['ml', ml],
    ['bn', bn],
    ['gu', gu],
    ['pa', pa],
    ['ur', ur],
    ['ja', ja],
    ['ko', ko],
    ['zh', zh],
  ];

  indicMap.sort((a, b) => b[1] - a[1]);
  if (indicMap[0][1] >= 2 || (indicMap[0][1] > 0 && latin === 0)) {
    if (indicMap[0][0] === 'hi') {
      const marathiIndicators = ['आहे', 'नाही', 'करा', 'काय', 'झाले', 'कसे', 'मला', 'आपण', 'होते', 'आणि'];
      if (marathiIndicators.some((w) => text.includes(w))) {
        return 'mr';
      }
    }
    return indicMap[0][0];
  }

  if (latin > 0) {
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
    // Return null for generic Latin text so explicit user selected language is not overridden
    return null;
  }

  return null;
}

export function resolveCurrentLanguage(
  promptText: string,
  explicitLang?: SupportedLanguage,
  sessionLang?: SupportedLanguage
): SupportedLanguage {
  const detected = detectScriptLanguage(promptText);
  if (detected) return detected;
  if (explicitLang) return explicitLang;
  if (sessionLang) return sessionLang;
  return 'en';
}

export function getSpeechLocale(langCode?: string | null): string {
  if (!langCode) return 'en-US';
  const map: Record<string, string> = {
    te: 'te-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    bn: 'bn-IN',
    gu: 'gu-IN',
    pa: 'pa-IN',
    ur: 'ur-PK',
    mr: 'mr-IN',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    ja: 'ja-JP',
    ko: 'ko-KR',
    zh: 'zh-CN',
    en: 'en-US'
  };
  return map[langCode] || 'en-US';
}
