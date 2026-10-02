import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  FileText, 
  Image as ImageIcon,
  Mic, 
  Headphones,
  Video,
  BarChart3,
  MoreVertical, 
  Edit2, 
  Trash2, 
  Check, 
  X,
  Sparkles,
  ChevronLeft,
  Filter,
  Star,
  LogOut
} from 'lucide-react';
import { Conversation, User } from '../types';
import { getFeatureConfig } from '../config/features';
import { ThemeToggle } from './ThemeToggle';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId?: string;
  activeFeatureId?: string;
  onSelectConversation: (conv: Conversation) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onToggleFavorite: (id: string) => Promise<void>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterByActiveFeature: boolean;
  onToggleFilterFeature: () => void;
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  onLogout?: () => void;
  onOpenAnalytics?: () => void;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeConversationId,
  activeFeatureId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onToggleFavorite,
  searchQuery,
  onSearchChange,
  filterByActiveFeature,
  onToggleFilterFeature,
  isOpen,
  onClose,
  user,
  onLogout,
  onOpenAnalytics,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const activeFeatureConfig = activeFeatureId ? getFeatureConfig(activeFeatureId) : null;

  const startEditing = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setMenuOpenId(null);
  };

  const handleSaveRename = async (id: string) => {
    if (editTitle.trim()) {
      await onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleConfirmDelete = async (id: string) => {
    await onDeleteConversation(id);
    setDeleteConfirmId(null);
    setMenuOpenId(null);
  };

  // Group conversations by date
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const favoriteConvs: Conversation[] = [];
  const todayConvs: Conversation[] = [];
  const yesterdayConvs: Conversation[] = [];
  const olderConvs: Conversation[] = [];

  conversations.forEach((conv) => {
    if (conv.is_favorite) {
      favoriteConvs.push(conv);
    }
    const time = new Date(conv.updated_at || conv.created_at).getTime();
    if (time >= todayStart) {
      todayConvs.push(conv);
    } else if (time >= yesterdayStart) {
      yesterdayConvs.push(conv);
    } else {
      olderConvs.push(conv);
    }
  });

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'document-analysis':
      case 'document':
        return <FileText size={14} className="text-blue-400 shrink-0" />;
      case 'visual-intelligence':
      case 'vision':
        return <ImageIcon size={14} className="text-purple-400 shrink-0" />;
      case 'ai-interview':
      case 'interview':
        return <Mic size={14} className="text-rose-400 shrink-0" />;
      case 'customer-support':
      case 'support':
        return <Headphones size={14} className="text-emerald-400 shrink-0" />;
      case 'video-audio-review':
      case 'meeting':
        return <Video size={14} className="text-amber-400 shrink-0" />;
      case 'data-study':
      case 'study':
      default:
        return <BarChart3 size={14} className="text-indigo-400 shrink-0" />;
    }
  };

  const renderSection = (title: string, list: Conversation[], isFavoriteSection = false) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-4">
        <div className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider font-mono flex items-center justify-between ${
          isFavoriteSection ? 'text-amber-500 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
        }`}>
          <span className="flex items-center gap-1.5">
            {isFavoriteSection && <Star size={11} className="fill-amber-400 text-amber-500 dark:text-amber-400" />}
            <span>{title}</span>
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400">
            {list.length}
          </span>
        </div>
        <div className="space-y-1 mt-1">
          {list.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = editingId === conv.id;
            const isConfirmingDelete = deleteConfirmId === conv.id;

            return (
              <div
                key={`${isFavoriteSection ? 'fav_' : ''}${conv.id}`}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs md:text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-950 dark:text-white border border-indigo-200 dark:border-indigo-500/40 shadow-sm font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/80 hover:text-slate-900 dark:hover:text-white border border-transparent'
                }`}
              >
                {/* Editing Inline Form */}
                {isEditing ? (
                  <div className="flex items-center gap-1.5 w-full">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(conv.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-2 py-1 rounded border border-indigo-500 text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => handleSaveRename(conv.id)}
                      className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded cursor-pointer"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : isConfirmingDelete ? (
                  /* Delete Confirmation Modal / Row */
                  <div className="flex items-center justify-between w-full py-0.5">
                    <span className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">Delete chat?</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleConfirmDelete(conv.id)}
                        className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard Conversation Row */
                  <>
                    <button
                      onClick={() => onSelectConversation(conv)}
                      className="flex items-center gap-2.5 min-w-0 text-left flex-1 cursor-pointer"
                    >
                      {getFeatureIcon(conv.feature)}
                      <span className="truncate font-medium">{conv.title}</span>
                    </button>

                    {/* Star Favorite Toggle Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(conv.id);
                      }}
                      title={conv.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                      className="p-1 rounded-lg text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-all duration-150 active:scale-125 cursor-pointer shrink-0"
                    >
                      {conv.is_favorite ? (
                        <Star size={13} className="fill-amber-400 text-amber-500 dark:text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                      ) : (
                        <Star size={13} className="hover:fill-amber-400/20" />
                      )}
                    </button>

                    {/* Actions Menu Trigger */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === conv.id ? null : conv.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-opacity cursor-pointer"
                        title="Options"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {/* Dropdown Options */}
                      {menuOpenId === conv.id && (
                        <div
                          className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-50 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => startEditing(conv)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            <Edit2 size={12} /> Rename
                          </button>
                          <button
                            onClick={() => {
                              setDeleteConfirmId(conv.id);
                              setMenuOpenId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/90 z-50 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col transition-colors duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* App Title & Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles size={16} />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">seeSpeak AI</span>
              <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">v2.1 Isolated Context</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white md:hidden"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Feature Scope Indicator / Filter Header */}
        {activeFeatureConfig && (
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
              <span className="text-slate-600 dark:text-slate-400 truncate">
                {filterByActiveFeature ? (
                  <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                    {activeFeatureConfig.title.toUpperCase()}
                  </span>
                ) : (
                  <span>ALL CONVERSATIONS</span>
                )}
              </span>
              <button
                onClick={onToggleFilterFeature}
                className="text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 flex items-center gap-1 font-mono cursor-pointer"
                title="Toggle feature filter"
              >
                <Filter size={11} />
                <span>{filterByActiveFeature ? 'Show All' : 'Filter'}</span>
              </button>
            </div>
          </div>
        )}

        {/* New Conversation Button */}
        <div className="p-3">
          <button
            onClick={onNewConversation}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs md:text-sm shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <Plus size={16} />
            <span>
              {activeFeatureConfig && filterByActiveFeature
                ? `New ${activeFeatureConfig.title.split(' ')[0]} Chat`
                : 'New Conversation'}
            </span>
          </button>
        </div>

        {/* Search Field */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-indigo-500/70"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          {conversations.length === 0 ? (
            <div className="text-center text-slate-500 dark:text-slate-600 text-xs py-8">
              {searchQuery ? 'No matching conversations' : 'No conversations in this workspace'}
            </div>
          ) : (
            <>
              {renderSection('Favorites', favoriteConvs, true)}
              {renderSection('Today', todayConvs)}
              {renderSection('Yesterday', yesterdayConvs)}
              {renderSection('Older', olderConvs)}
            </>
          )}
        </div>

        {/* Analytics Shortcut Button */}
        {onOpenAnalytics && (
          <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20">
            <button
              onClick={onOpenAnalytics}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/40 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <BarChart3 size={15} className="text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Personal Analytics</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                Live
              </span>
            </button>
          </div>
        )}

        {/* User Account / Logout / Theme section */}
        {user && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-900 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0 shadow-sm">
                {user.name ? user.name[0] : 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate">{user.name}</span>
                <span className="text-[10px] text-slate-500 truncate font-mono">{user.email}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle size="sm" />
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-900 border border-transparent hover:border-slate-300 dark:hover:border-slate-800 transition-colors cursor-pointer shrink-0"
                  aria-label="Logout"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-900 text-center text-[11px] text-slate-500 dark:text-slate-600 font-mono">
          Context & Files Strictly Isolated
        </div>
      </aside>
    </>
  );
};
