import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { 
  Sparkles, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (route: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register(cleanName, cleanEmail, password);
      if (res.success) {
        onNavigate('/app');
      } else {
        setErrorMessage(res.error || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-800 dark:selection:text-indigo-200 overflow-y-auto transition-colors duration-200">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-indigo-500/10 dark:from-indigo-600/15 via-purple-500/10 dark:via-purple-600/10 to-transparent blur-[130px]" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-500/10 dark:bg-purple-600/10 rounded-full blur-[100px]" />
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
          onClick={() => onNavigate('/')}
          className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shadow-sm"
          aria-label="Back to home"
        >
          <ArrowLeft size={14} />
          <span>Back to Intro</span>
        </button>

        <div className="pointer-events-auto">
          <ThemeToggle size="sm" />
        </div>
      </div>

      {/* Register Card */}
      <div className="relative z-10 w-full max-w-md my-8">
        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 backdrop-blur-xl p-7 sm:p-9 shadow-2xl shadow-slate-200/50 dark:shadow-black/60 transition-colors duration-200">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-7">
            <div 
              onClick={() => onNavigate('/')}
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-[1px] shadow-lg shadow-indigo-600/30 mb-3 cursor-pointer hover:scale-105 transition-transform"
            >
              <div className="w-full h-full rounded-[15px] bg-white dark:bg-slate-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Sparkles size={22} />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1.5">
              Create an Account
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-light">
              Get started with SeeSpeak AI workspaces
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs sm:text-sm animate-fadeIn">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label 
                htmlFor="reg-name" 
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-mono"
              >
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <User size={16} />
                </div>
                <input
                  id="reg-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  required
                  disabled={isLoading}
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm rounded-xl pl-10 pr-4 py-2.5 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label 
                htmlFor="reg-email" 
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-mono"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Mail size={16} />
                </div>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm rounded-xl pl-10 pr-4 py-2.5 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label 
                  htmlFor="reg-password" 
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 font-mono"
                >
                  Password
                </label>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">Min 6 characters</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock size={16} />
                </div>
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm rounded-xl pl-10 pr-11 py-2.5 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label 
                  htmlFor="reg-confirm-password" 
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 font-mono"
                >
                  Confirm Password
                </label>
                {passwordsMatch && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 size={12} /> Passwords match
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock size={16} />
                </div>
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm rounded-xl pl-10 pr-11 py-2.5 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all duration-150 hover:shadow-indigo-600/40 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Registering account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400">
            <span>Already have an account? </span>
            <button
              onClick={() => onNavigate('/login')}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:underline transition-colors cursor-pointer ml-1"
            >
              Log in here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
