import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  Send,
  X,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { SupportTicket, TicketMessage, SupportedLanguage } from '../types';
import { useTranslation } from '../locales/i18n';
import { authFetch } from '../utils/authFetch';

interface SupportTicketManagerProps {
  language: SupportedLanguage;
  activeTicket: SupportTicket | null;
  onSelectActiveTicket: (ticket: SupportTicket | null) => void;
  isOpen: boolean;
  onClose: () => void;
}

const TICKET_STATUSES = ['Open', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed'];
const TICKET_CATEGORIES = ['Technical Support', 'Billing & Payments', 'Account & Security', 'Feature Request', 'General Inquiry'];
const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

export const SupportTicketManager: React.FC<SupportTicketManagerProps> = ({
  language,
  activeTicket,
  onSelectActiveTicket,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation(language);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  // New Ticket Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState(TICKET_CATEGORIES[0]);
  const [newPriority, setNewPriority] = useState('Medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected Ticket Detail & Message State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Fetch Tickets
  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());

      const res = await authFetch(`/api/tickets?${params.toString()}`);
      if (res.ok) {
        const data: SupportTicket[] = await res.json();
        setTickets(data);
      }
    } catch (e) {
      console.error('Failed to fetch tickets:', e);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      fetchTickets();
    }
  }, [isOpen, fetchTickets]);

  // Sync selectedTicket with activeTicket if opened
  useEffect(() => {
    if (activeTicket && !selectedTicket) {
      setSelectedTicket(activeTicket);
    }
  }, [activeTicket, selectedTicket]);

  // Create Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newSubject.trim(),
          description: newDescription.trim(),
          category: newCategory,
          priority: newPriority,
          language: language,
        }),
      });

      if (res.ok) {
        const created: SupportTicket = await res.json();
        setShowCreateModal(false);
        setNewSubject('');
        setNewDescription('');
        await fetchTickets();
        setSelectedTicket(created);
        onSelectActiveTicket(created);
      }
    } catch (err) {
      console.error('Error creating ticket:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Comment / Message to Ticket
  const handleAddMessage = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setIsSendingReply(true);
    try {
      const res = await authFetch(`/api/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_type: 'user',
          message: replyMessage.trim(),
        }),
      });
      if (res.ok) {
        const updated: SupportTicket = await res.json();
        setSelectedTicket(updated);
        setReplyMessage('');
        fetchTickets();
        if (activeTicket?.id === updated.id) {
          onSelectActiveTicket(updated);
        }
      }
    } catch (e) {
      console.error('Error adding ticket message:', e);
    } finally {
      setIsSendingReply(false);
    }
  };

  // Update Status
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    try {
      const res = await authFetch(`/api/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated: SupportTicket = await res.json();
        setSelectedTicket(updated);
        fetchTickets();
        if (activeTicket?.id === updated.id) {
          onSelectActiveTicket(updated);
        }
      }
    } catch (e) {
      console.error('Error updating status:', e);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'In Progress':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Waiting for Customer':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Resolved':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Closed':
        return 'bg-slate-700/40 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'text-rose-400 font-bold';
      case 'High':
        return 'text-amber-400 font-semibold';
      case 'Medium':
        return 'text-indigo-300';
      default:
        return 'text-slate-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex justify-end">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 h-full flex flex-col shadow-2xl animate-slideLeft transition-colors duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Ticket size={22} className="text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t('support.tickets', 'Support Tickets')}</span>
                {activeTicket && (
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                    Active: {activeTicket.ticket_number}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Track and manage customer support issues with AI context</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Plus size={14} />
              <span>{t('support.create_ticket', 'Create Ticket')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Selected Ticket Detail View OR List View */}
        {selectedTicket ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Ticket Detail Header */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  &larr; Back to all tickets
                </button>
                <div className="flex items-center gap-2">
                  {/* Select as active context for AI voice/chat */}
                  <button
                    onClick={() => {
                      if (activeTicket?.id === selectedTicket.id) {
                        onSelectActiveTicket(null);
                      } else {
                        onSelectActiveTicket(selectedTicket);
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeTicket?.id === selectedTicket.id
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <Sparkles size={13} className={activeTicket?.id === selectedTicket.id ? 'text-emerald-600 dark:text-emerald-400' : ''} />
                    <span>
                      {activeTicket?.id === selectedTicket.id ? 'AI Context Active' : 'Set as AI Context'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                    {selectedTicket.ticket_number}
                  </span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadge(selectedTicket.status)}`}>
                    {selectedTicket.status}
                  </span>
                  <span className={`text-[11px] ${getPriorityBadge(selectedTicket.priority)}`}>
                    {selectedTicket.priority} Priority
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-auto">{selectedTicket.category}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">{selectedTicket.subject}</h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Status Update Dropdown */}
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1">
                <span>Update Status:</span>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  {TICKET_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ticket Message Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
                Conversation History
              </span>

              {(selectedTicket.messages || []).length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">No additional messages recorded on this ticket.</p>
              ) : (
                (selectedTicket.messages || []).map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl border text-xs max-w-[85%] ${
                      m.sender_type === 'user'
                        ? 'ml-auto bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                        : m.sender_type === 'system'
                        ? 'mx-auto bg-slate-100 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-center text-[11px] italic'
                        : 'mr-auto bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase mb-1 opacity-75">
                      <span>{m.sender_type}</span>
                      <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="leading-relaxed">{m.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Message Box */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMessage();
                }}
                placeholder={t('support.add_comment', 'Add a response / comment...')}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full px-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
              />
              <button
                disabled={isSendingReply || !replyMessage.trim()}
                onClick={handleAddMessage}
                className="p-2 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors cursor-pointer shadow-sm"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        ) : (
          /* Ticket List View */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Search and Filters */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-950/40">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('support.search_tickets', 'Search tickets by subject, description or ID...')}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  {TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button
                  onClick={fetchTickets}
                  title="Refresh tickets"
                  className="ml-auto p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {tickets.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <Ticket size={32} className="text-slate-400 dark:text-slate-600" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('support.no_tickets', 'No support tickets found.')}
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-2 px-4 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    + Create Your First Ticket
                  </button>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      activeTicket?.id === ticket.id
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/40 shadow-md'
                        : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                          {ticket.ticket_number}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadge(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </div>
                      <span className={`text-[10px] ${getPriorityBadge(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{ticket.subject}</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">{ticket.description}</p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <span>{ticket.category}</span>
                      <span>Updated {new Date(ticket.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Modal: Create Ticket */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp text-slate-900 dark:text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Ticket size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <span>{t('support.create_ticket', 'Create Support Ticket')}</span>
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('support.subject', 'Subject')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="Brief description of the issue..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      {t('support.category', 'Category')}
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      {TICKET_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      {t('support.priority', 'Priority')}
                    </label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      {TICKET_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('support.description', 'Problem Description')} *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Provide details about what happened, steps to reproduce, or questions..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-full text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newSubject.trim() || !newDescription.trim()}
                    className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold transition-all shadow-md cursor-pointer"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
