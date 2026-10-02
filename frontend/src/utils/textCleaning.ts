/**
 * Utility to clean markdown, internal headers, and special symbols from AI responses
 * to ensure clean, human-like voice synthesis without spoken punctuation artifacts.
 */
export function cleanForSpeechOutput(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // Remove markdown code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, ' ');

  // Remove inline code ticks
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // Remove markdown headers (# Title, ## Subtitle)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // Remove bold / italic symbols (**bold**, *italic*, __bold__, _italic_)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');

  // Remove bullet points and numbered list markers
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '');
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');

  // Remove blockquotes (> quote)
  cleaned = cleaned.replace(/^\s*>\s+/gm, '');

  // Remove horizontal rules
  cleaned = cleaned.replace(/^\s*[-*_]{3,}\s*$/gm, '');

  // Remove markdown links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Collapse multiple spaces/newlines into clean spacing
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}
