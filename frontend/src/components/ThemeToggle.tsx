import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  size = 'md',
  showLabel = false,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const isSmall = size === 'sm';
  const widthClass = isSmall ? 'w-[52px]' : 'w-[60px]';
  const heightClass = isSmall ? 'h-[28px]' : 'h-[32px]';
  const thumbSize = isSmall ? 'w-5 h-5' : 'w-6 h-6';
  const iconSize = isSmall ? 11 : 13;
  const translateClass = isSmall ? 'translate-x-[24px]' : 'translate-x-[28px]';

  return (
    <button
      type="button"
      id="theme-toggle-btn"
      data-testid="theme-toggle-btn"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTheme();
      }}
      role="switch"
      aria-checked={isDark}
      className={`group relative inline-flex items-center ${widthClass} ${heightClass} rounded-full p-[2px] cursor-pointer transition-colors duration-200 select-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 active:scale-95 shadow-inner ${
        isDark
          ? 'bg-slate-900 border border-slate-700/80 hover:border-indigo-500/50'
          : 'bg-slate-200/90 border border-slate-300 hover:border-slate-400'
      } ${className}`}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Dark Mode active (Click to switch to Light Mode)' : 'Light Mode active (Click to switch to Dark Mode)'}
    >
      {/* Sliding Thumb */}
      <span
        className={`absolute top-[2px] left-[2px] ${thumbSize} rounded-full transition-transform duration-200 ease-out flex items-center justify-center shadow-md pointer-events-none ${
          isDark
            ? `${translateClass} bg-slate-950 border border-indigo-500/40 text-indigo-400`
            : 'translate-x-0 bg-white border border-slate-200 text-amber-500'
        }`}
      >
        {isDark ? (
          <Moon size={iconSize} className="shrink-0" />
        ) : (
          <Sun size={iconSize} className="shrink-0" />
        )}
      </span>

      {/* Track Icons for visual affordance */}
      <span className="w-full flex items-center justify-between px-1.5 pointer-events-none">
        <Sun
          size={iconSize}
          className={`shrink-0 transition-opacity duration-200 ${
            isDark ? 'opacity-40 text-slate-400' : 'opacity-0'
          }`}
        />
        <Moon
          size={iconSize}
          className={`shrink-0 transition-opacity duration-200 ${
            isDark ? 'opacity-0' : 'opacity-40 text-slate-500'
          }`}
        />
      </span>

      {showLabel && (
        <span className="sr-only">
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </button>
  );
};

