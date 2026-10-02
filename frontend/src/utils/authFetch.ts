/**
 * authFetch wrapper that automatically attaches the user's Bearer token
 * and passes credentials for cookies.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('seespeak_auth_token');
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'same-origin',
  });
}
