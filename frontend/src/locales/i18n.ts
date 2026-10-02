import en from './en.json';
import te from './te.json';
import hi from './hi.json';
import es from './es.json';
import fr from './fr.json';
import de from './de.json';
import ja from './ja.json';
import zh from './zh.json';
import { SupportedLanguage } from '../types';

const TRANSLATIONS: Record<string, any> = {
  en,
  te,
  hi,
  es,
  fr,
  de,
  ja,
  zh,
};

function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj) return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  return typeof curr === 'string' ? curr : undefined;
}

export function t(key: string, language: SupportedLanguage | string = 'en', fallback?: string): string {
  const lang = (language || 'en').toLowerCase();
  const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];

  // Try active language
  const val = getNestedValue(dict, key);
  if (val) return val;

  // Fallback to English
  const enVal = getNestedValue(TRANSLATIONS['en'], key);
  if (enVal) return enVal;

  return fallback || key;
}

export function useTranslation(language: SupportedLanguage | string = 'en') {
  return {
    t: (key: string, fallback?: string) => t(key, language, fallback),
    language,
  };
}
