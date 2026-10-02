import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'seespeak_theme';

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    if (document.documentElement.classList.contains('dark')) {
      return 'dark';
    }
  }
  return 'light';
};

const applyThemeToDOM = (theme: Theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = theme === 'dark';

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
    if (document.body) {
      document.body.classList.add('dark');
      document.body.classList.remove('light');
      document.body.setAttribute('data-theme', 'dark');
    }
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    if (document.body) {
      document.body.classList.remove('dark');
      document.body.classList.add('light');
      document.body.setAttribute('data-theme', 'light');
    }
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Apply theme immediately on mount and whenever theme changes
  useEffect(() => {
    applyThemeToDOM(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {}
  }, [theme]);

  // Sync across tabs if changed elsewhere
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        applyThemeToDOM(e.newValue);
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    applyThemeToDOM(newTheme);
    try {
      localStorage.setItem(THEME_KEY, newTheme);
    } catch (_) {}
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      applyThemeToDOM(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (_) {}
      return next;
    });
  }, []);

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
