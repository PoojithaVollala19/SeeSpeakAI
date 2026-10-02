import React, { useState } from 'react';
import { ThemeToggle } from '../components/ThemeToggle';
import { 
  Sparkles, 
  Mail, 
  Lock, 
  KeyRound, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft 
} from 'lucide-react';

interface ForgotPasswordPageProps {
  onNavigate: (route: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Request Password Reset
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(data.message || 'Reset instructions have been generated.');
        if (data.reset_token) {
          // Prefill token for instant demo / verification
          setResetToken(data.reset_token);
        }
        setStep('reset');
      } else {
        setErrorMessage(data.detail || 'Could not process password reset request.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error connecting to server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Set New Password
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setMessage(null);

    const cleanToken = resetToken.trim();
    if (!cleanToken) {
      setErrorMessage('Please enter the reset token.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken, password: newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage('Password updated successfully! You can now log in with your new password.');
        setTimeout(() => {
          onNavigate('/login');
        }, 1800);
      } else {
        setErrorMessage(data.detail || 'Invalid or expired reset token.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error connecting to server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-800 dark:selection:text-indigo-200 overflow-y-auto transition-colors duration-200">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-indigo-500/10 dark:from-indigo-600/15 via-purple-500/10 dark:via-purple-600/10 to-transparent blur-[130px]" />
      </div>

      {/* Grid pattern */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.035] dark:opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Top Header Controls: Back & Theme Toggle */}
      <div className="fixed top-5 inset-x-5 z-20 flex items-center justify-between pointer-events-none">
        <button
          onClick={() => onNavigate('/login')}
          className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shadow-sm"
          aria-label="Back to login"
        >
          <ArrowLeft size={14} />
          <span>Back to Login</span>
        </button>

        <div className="pointer-events-auto">
          <ThemeToggle size="sm" />
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md my-8">
        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 backdrop-blur-xl p-7 sm:p-9 shadow-2xl shadow-slate-200/50 dark:shadow-black/60 transition-colors duration-200">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-[1px] shadow-lg shadow-indigo-600/30 mb-3">
              <div className="w-full h-full rounded-[15px] bg-white dark:bg-slate-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <KeyRound size={22} />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1.5">
              Reset Password
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-light">
              {step === 'request'
                ? 'Enter your account email to receive a password reset token.'
                : 'Enter your reset token and your new password.'}
            </p>
          </div>

          {/* Feedback Banners */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs sm:text-sm animate-fadeIn">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {message && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm animate-fadeIn">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>{message}</span>
            </div>
          )}

          {/* Step 1: Request */}
          {step === 'request' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label 
                  htmlFor="forgot-email" 
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 font-mono"
                >
                  Account Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Mail size={16} />
                  </div>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={isLoading}
                    className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm rounded-xl pl-10 pr-4 py-2.5 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Generating token...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Reset</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 2: Reset Form */}
          {step === 'reset' && (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div>
                <label 
                  htmlFor="reset-token" 
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-mono"
                >
                  Reset Token
                </label>
                <input
                  id="reset-token"
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste reset token here"
                  required
                  disabled={isLoading}
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm rounded-xl px-3.5 py-2.5 font-mono placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                />
              </div>

              <div>
                <label 
                  htmlFor="reset-new-pw" 
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-mono"
                >
                  New Password
                </label>
                <input
                  id="reset-new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  disabled={isLoading}
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm rounded-xl px-3.5 py-2.5 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                />
              </div>

              <div>
                <label 
                  htmlFor="reset-confirm-pw" 
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-mono"
                >
                  Confirm New Password
                </label>
                <input
                  id="reset-confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  disabled={isLoading}
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm rounded-xl px-3.5 py-2.5 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md transition-all cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}

          {/* Links */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400">
            <span>Remember your password? </span>
            <button
              onClick={() => onNavigate('/login')}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:underline transition-colors cursor-pointer ml-1"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
