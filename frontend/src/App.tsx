import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { InterviewSession } from './pages/InterviewSession';
import { SupportSession } from './pages/SupportSession';
import { FeatureWorkspace } from './pages/FeatureWorkspace';
import { ConversationSidebar } from './components/ConversationSidebar';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { Conversation, SupportedLanguage } from './types';
import { getFeatureConfig } from './config/features';
import { authFetch } from './utils/authFetch';
import { Menu, Sparkles } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Current route tracked from URL
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  // Feature-isolated conversation IDs map: { [featureId]: conversationId }
  const [activeConversationByFeature, setActiveConversationByFeature] = useState<Record<string, string | undefined>>({});

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByActiveFeature, setFilterByActiveFeature] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Sync route with browser history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (route: string) => {
    window.history.pushState({}, '', route);
    setCurrentRoute(route);
    setIsSidebarOpen(false);
  };

  const handleLogout = async () => {
    setConversations([]);
    setActiveConversationByFeature({});
    await logout();
    navigate('/');
  };

  // Parse active feature & conversation ID from the URL
  const { currentFeatureId, routeConversationId } = useMemo(() => {
    let clean = currentRoute.replace(/^\//, '');
    if (!clean) return { currentFeatureId: undefined, routeConversationId: undefined };

    // Strip optional /app/ prefix (e.g. /app/document-analysis -> document-analysis)
    if (clean === 'app' || clean.startsWith('app/')) {
      clean = clean.replace(/^app\/?/, '');
      if (!clean) return { currentFeatureId: undefined, routeConversationId: undefined };
    }

    // Public / static auth routes
    if (clean === 'login' || clean === 'register' || clean === 'forgot-password' || clean === 'intro') {
      return { currentFeatureId: undefined, routeConversationId: undefined };
    }

    // Format: /:featureId/c/:conversationId
    if (clean.includes('/c/')) {
      const parts = clean.split('/c/');
      const featConfig = getFeatureConfig(parts[0]);
      return {
        currentFeatureId: featConfig.id,
        routeConversationId: parts[1] || undefined,
      };
    }

    // Direct feature route (e.g. /document-analysis or /ai-interview)
    const featConfig = getFeatureConfig(clean);
    return {
      currentFeatureId: featConfig.id,
      routeConversationId: undefined,
    };
  }, [currentRoute]);

  // Determine active conversation for the active feature
  const activeConversationId = useMemo(() => {
    if (routeConversationId) return routeConversationId;
    if (currentFeatureId) {
      return activeConversationByFeature[currentFeatureId];
    }
    return undefined;
  }, [routeConversationId, currentFeatureId, activeConversationByFeature]);

  // Fetch conversation history (scoped by feature if inside a feature workspace)
  const fetchConversations = useCallback(
    async (query: string = '', featureFilter?: string) => {
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.append('q', query.trim());
        if (featureFilter && featureFilter !== 'all') {
          params.append('feature', featureFilter);
        }

        const qs = params.toString();
        const url = qs ? `/api/conversations?${qs}` : '/api/conversations';
        const res = await authFetch(url);
        if (res.ok) {
          const data: Conversation[] = await res.json();
          setConversations(data);
        }
      } catch (e) {
        console.error('Failed to fetch conversations:', e);
      }
    },
    []
  );

  // Re-fetch conversations when user, feature, search query, or filter toggle changes
  useEffect(() => {
    if (isAuthenticated) {
      const targetFeature = filterByActiveFeature ? currentFeatureId : undefined;
      fetchConversations(searchQuery, targetFeature);
    } else {
      setConversations([]);
      setActiveConversationByFeature({});
    }
  }, [isAuthenticated, user?.id, fetchConversations, searchQuery, currentFeatureId, filterByActiveFeature]);

  // Rename Conversation
  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const res = await authFetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        const targetFeature = filterByActiveFeature ? currentFeatureId : undefined;
        await fetchConversations(searchQuery, targetFeature);
      }
    } catch (e) {
      console.error('Failed to rename conversation:', e);
    }
  };

  // Delete Conversation
  const handleDeleteConversation = async (id: string) => {
    try {
      const res = await authFetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (activeConversationId === id) {
          if (currentFeatureId) {
            setActiveConversationByFeature((prev) => ({
              ...prev,
              [currentFeatureId]: undefined,
            }));
            navigate(`/${currentFeatureId}`);
          } else {
            navigate('/app');
          }
        }
        const targetFeature = filterByActiveFeature ? currentFeatureId : undefined;
        await fetchConversations(searchQuery, targetFeature);
      }
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  };

  // Toggle Favorite Status (Optimistic UI update + Backend persistence)
  const handleToggleFavorite = async (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_favorite: !c.is_favorite } : c))
    );

    try {
      const res = await authFetch(`/api/conversations/${id}/favorite`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, is_favorite: data.is_favorite } : c))
        );
      } else {
        const targetFeature = filterByActiveFeature ? currentFeatureId : undefined;
        await fetchConversations(searchQuery, targetFeature);
      }
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
      const targetFeature = filterByActiveFeature ? currentFeatureId : undefined;
      await fetchConversations(searchQuery, targetFeature);
    }
  };

  // Select a Conversation from History -> Restore in its own dedicated workspace
  const handleSelectConversation = async (conv: Conversation) => {
    const featConfig = getFeatureConfig(conv.feature);
    const targetFeatureId = featConfig.id;

    setActiveConversationByFeature((prev) => ({
      ...prev,
      [targetFeatureId]: conv.id,
    }));

    navigate(`/${targetFeatureId}/c/${conv.id}`);
  };

  // Start New Conversation strictly inside the current workspace
  const handleNewConversation = () => {
    if (currentFeatureId) {
      setActiveConversationByFeature((prev) => ({
        ...prev,
        [currentFeatureId]: undefined,
      }));
      setInitialPrompt(undefined);
      navigate(`/${currentFeatureId}`);
    } else {
      navigate('/app');
    }
  };

  // Select Quick Prompt from Home
  const handleSelectPrompt = (prompt: string, featureId: string) => {
    const featConfig = getFeatureConfig(featureId);
    setActiveConversationByFeature((prev) => ({
      ...prev,
      [featConfig.id]: undefined,
    }));
    setInitialPrompt(prompt);
    navigate(`/${featConfig.id}`);
  };

  // Loading state while verifying token with backend
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-[1px] shadow-xl shadow-indigo-600/30 animate-pulse">
            <div className="w-full h-full rounded-[15px] bg-white dark:bg-slate-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles size={22} />
            </div>
          </div>
          <span className="text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">Loading SeeSpeak AI...</span>
        </div>
      </div>
    );
  }

  // --- UN-AUTHENTICATED ROUTING ---
  if (!isAuthenticated) {
    if (currentRoute === '/login') {
      return <LoginPage onNavigate={navigate} />;
    }
    if (currentRoute === '/register') {
      return <RegisterPage onNavigate={navigate} />;
    }
    if (currentRoute === '/forgot-password') {
      return <ForgotPasswordPage onNavigate={navigate} />;
    }
    if (currentRoute === '/' || currentRoute === '/intro') {
      return <LandingPage onNavigate={navigate} />;
    }
    // Protected route accessed while unauthenticated: redirect to login
    return <LoginPage onNavigate={navigate} redirectTo={currentRoute} />;
  }

  // --- AUTHENTICATED ROUTING ---
  // If authenticated user visits login or register, redirect them to dashboard
  if (currentRoute === '/login' || currentRoute === '/register') {
    navigate('/app');
    return null;
  }

  // Explicit /intro route viewable even when authenticated
  if (currentRoute === '/intro') {
    return <LandingPage onNavigate={navigate} />;
  }

  if (currentRoute === '/forgot-password') {
    return <ForgotPasswordPage onNavigate={navigate} />;
  }

  // Render Protected Feature Workspaces or Main Dashboard
  const renderContent = () => {
    if (currentFeatureId === 'ai-interview') {
      return (
        <InterviewSession
          onBack={() => navigate('/app')}
          selectedLanguage={selectedLanguage}
          onSelectLanguage={setSelectedLanguage}
          onSelectFeature={(r) => navigate(r)}
          onNewConversation={handleNewConversation}
        />
      );
    }

    if (currentFeatureId === 'customer-support') {
      return (
        <SupportSession
          key={activeConversationId || 'new'}
          conversationId={activeConversationId}
          onBack={() => navigate('/app')}
          selectedLanguage={selectedLanguage}
          onSelectLanguage={setSelectedLanguage}
          onSelectFeature={(r) => navigate(r)}
          onNewConversation={handleNewConversation}
          onConversationCreated={(newConv) => {
            setActiveConversationByFeature((prev) => ({
              ...prev,
              ['customer-support']: newConv.id,
            }));
            const targetFeature = filterByActiveFeature ? 'customer-support' : undefined;
            fetchConversations(searchQuery, targetFeature);
            navigate(`/customer-support/c/${newConv.id}`);
          }}
        />
      );
    }

    if (currentFeatureId) {
      return (
        <FeatureWorkspace
          key={currentFeatureId}
          featureId={currentFeatureId}
          conversationId={activeConversationId}
          selectedLanguage={selectedLanguage}
          onSelectLanguage={setSelectedLanguage}
          onBack={() => navigate('/app')}
          onNewConversation={handleNewConversation}
          onSelectFeature={(r) => navigate(r)}
          onConversationCreated={(newConv) => {
            setActiveConversationByFeature((prev) => ({
              ...prev,
              [currentFeatureId]: newConv.id,
            }));
            const targetFeature = filterByActiveFeature ? currentFeatureId : undefined;
            fetchConversations(searchQuery, targetFeature);
          }}
          initialPrompt={initialPrompt}
        />
      );
    }

    if (currentRoute === '/analytics') {
      return (
        <AnalyticsDashboard
          onClose={() => navigate('/app')}
          onNavigate={(r) => navigate(r)}
        />
      );
    }

    // Default: Home Dashboard
    return (
      <HomePage
        onNavigate={navigate}
        selectedLanguage={selectedLanguage}
        onSelectPrompt={handleSelectPrompt}
        onShowIntro={() => navigate('/intro')}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        user={user}
        onLogout={handleLogout}
      />
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="fixed top-3 left-3 z-40 p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 md:hidden shadow-md cursor-pointer"
        aria-label="Toggle history menu"
      >
        <Menu size={18} />
      </button>

      {/* Feature-Scoped Conversation Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        activeFeatureId={currentFeatureId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onToggleFavorite={handleToggleFavorite}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterByActiveFeature={filterByActiveFeature}
        onToggleFilterFeature={() => setFilterByActiveFeature(!filterByActiveFeature)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        onLogout={handleLogout}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
      />

      {/* Main Workspace Stage */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {renderContent()}

        {/* Analytics Modal overlay if opened via sidebar or button */}
        {isAnalyticsOpen && (
          <AnalyticsDashboard
            isModal={true}
            onClose={() => setIsAnalyticsOpen(false)}
            onNavigate={(r) => {
              setIsAnalyticsOpen(false);
              navigate(r);
            }}
          />
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
