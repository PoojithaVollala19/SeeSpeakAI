import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthResponse } from '../types';
import { getApiUrl } from '../utils/apiUrl';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'seespeak_auth_token';
const USER_KEY = 'seespeak_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });

  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem(USER_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_) {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate active token with backend
  const checkAuth = useCallback(async () => {
    const activeToken = localStorage.getItem(TOKEN_KEY);
    if (!activeToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(getApiUrl('/api/auth/me'), {
        headers: {
          'Authorization': `Bearer ${activeToken}`,
        },
      });

      if (res.ok) {
        try {
          const data: AuthResponse = await res.json();
          if (data.user) {
            setUser(data.user);
            setToken(activeToken);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          }
        } catch {
          // Ignore non-JSON response during background auth validation
        }
      } else if (res.status === 401) {
        // Token expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      console.warn('[AUTH] Could not verify authentication status with server:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login handler
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response (e.g. HTML 404/502 from proxy or gateway)
      }

      if (!res.ok) {
        const errorMsg = data?.detail || (res.status === 404 ? 'Authentication service unreachable (404). Please verify backend connection.' : `Server error (${res.status}). Please try again.`);
        return { success: false, error: errorMsg };
      }

      if (data && data.token && data.user) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: 'Login failed: missing token from server.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error connecting to server.' };
    }
  };

  // Register handler
  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response (e.g. HTML 404/502 from proxy or gateway)
      }

      if (!res.ok) {
        const errorMsg = data?.detail || (res.status === 404 ? 'Authentication service unreachable (404). Please verify backend connection.' : `Server error (${res.status}). Please try again.`);
        return { success: false, error: errorMsg };
      }

      if (data && data.token && data.user) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: 'Registration succeeded, but session could not be established.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error connecting to server.' };
    }
  };

  // Logout handler
  const logout = async (): Promise<void> => {
    const activeToken = token || localStorage.getItem(TOKEN_KEY);
    if (activeToken) {
      try {
        await fetch(getApiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${activeToken}` },
        });
      } catch (err) {
        console.warn('[AUTH] Error during logout API call:', err);
      }
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
