/**
 * Resolves API and static asset URLs.
 * In development, returns relative URLs so Vite proxy can handle them.
 * In production, prefixes relative URLs with VITE_API_URL if configured.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

export function getApiUrl(path: string): string {
  if (!path) return path;
  if (!API_BASE_URL) return path;
  // If already an absolute URL, don't modify it
  if (/^https?:\/\//i.test(path)) return path;

  let base = API_BASE_URL;
  let cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Prevent accidental /api/api/... duplication if VITE_API_URL includes /api
  if (base.endsWith('/api') && cleanPath.startsWith('/api')) {
    cleanPath = cleanPath.slice(4);
  }

  return `${base}${cleanPath}`;
}
