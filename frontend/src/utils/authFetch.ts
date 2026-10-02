import { getApiUrl } from './apiUrl';

/**
 * authFetch wrapper that automatically attaches the user's Bearer token
 * and resolves base API URL depending on environment.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('seespeak_auth_token');
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const resolvedInput = typeof input === 'string' ? getApiUrl(input) : input;

  return fetch(resolvedInput, {
    ...init,
    headers,
    credentials: init?.credentials || 'same-origin',
  });
}
