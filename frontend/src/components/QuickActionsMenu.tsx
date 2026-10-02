import React, { useState, useRef, useEffect } from 'react';
import { 
  Zap, 
  ChevronDown, 
  BookOpen, 
  FileText, 
  Star, 
  HelpCircle, 
  ListOrdered, 
  Layers, 
  Sparkles, 
  FileCheck, 
  Clock, 
  Compass, 
  CheckCircle2
} from 'lucide-react';

export type ExplanationLevel = 'Light' | 'Moderate' | 'Detailed';

export interface QuickActionItem {
  id: string;
  label: string;
  shortDesc: string;
  icon: React.ReactNode;
  generatePrompt: (level: ExplanationLevel) => string;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    id: 'exam',
    label: 'Explain for Exam',
    shortDesc: 'Scoring points, 2/5/10-mark breakdown & pitfalls',
    icon: <BookOpen size={16} className="text-blue-400" />,
    generatePrompt: (level) =>
      `Please explain the attached content/topic specifically for an EXAM. Structure your answer with:\n1. Core Definition & Key Terminology\n2. Primary Principles and Theoretical Foundations\n3. Structured 2-mark, 5-mark, and 10-mark exam questions and expected scoring points\n4. Essential diagrams, tables, or formula references\n5. Common exam mistakes and pitfalls to avoid.\n[Depth Level: ${level}]`,
  },
  {
    id: 'short-notes',
    label: 'Make Short Notes',
    shortDesc: 'Crisp bullet points with formulas & bold key terms',
    icon: <FileText size={16} className="text-emerald-400" />,
    generatePrompt: (level) =>
      `Please generate crisp, high-yield SHORT REVISION NOTES based on the attached files/context. Use formatted bullet points, highlight all critical formulas, bold key terms, and end with a 3-bullet rapid memory recap.\n[Depth Level: ${level}]`,
  },
  {
    id: 'important-points',
    label: 'Extract Important Points',
    shortDesc: 'Prioritized core takeaways and critical findings',
    icon: <Star size={16} className="text-amber-400" />,
    generatePrompt: (level) =>
      `Extract and prioritize the MOST IMPORTANT POINTS from the attached files/context. Present them in ranked order of significance with concise explanatory reasoning for each.\n[Depth Level: ${level}]`,
  },
  {
    id: 'detailed-explanation',
    label: 'Detailed Explanation',
    shortDesc: 'Exhaustive deep-dive with underlying mechanisms',
    icon: <Layers size={16} className="text-indigo-400" />,
    generatePrompt: () =>
      `Provide a comprehensive, in-depth, and exhaustive explanation of the attached files/content. Analyze the underlying mechanisms, context, edge cases, real-world examples, and architectural or theoretical justifications in full detail.\n[Depth Level: Detailed]`,
  },
  {
    id: 'quick-explanation',
    label: 'Quick / Light Explanation',
    shortDesc: '2-minute high-level overview of core concepts',
    icon: <Clock size={16} className="text-cyan-400" />,
    generatePrompt: () =>
      `Provide a fast, high-level summary and light explanation of the attached files/context in under 2 minutes of reading time. Focus strictly on the primary concept and key takeaway.\n[Depth Level: Light]`,
  },
  {
    id: 'moderate-explanation',
    label: 'Moderate Explanation',
    shortDesc: 'Balanced coverage with clear examples',
    icon: <Compass size={16} className="text-violet-400" />,
    generatePrompt: () =>
      `Provide a well-balanced, clear explanation of the attached files/context covering the main concepts, logical progression, and relevant examples without unnecessary verbosity.\n[Depth Level: Moderate]`,
  },
  {
    id: 'simple-explanation',
    label: 'Simple Explanation',
    shortDesc: 'ELI5 plain English with intuitive analogies',
    icon: <Sparkles size={16} className="text-pink-400" />,
    generatePrompt: (level) =>
      `Explain the attached files/concept in the simplest possible terms (ELI5 style). Use everyday analogies, conversational language, and eliminate jargon so anyone can understand immediately.\n[Depth Level: ${level}]`,
  },
  {
    id: 'summarize-document',
    label: 'Summarize Document',
    shortDesc: 'Executive summary with objectives & findings',
    icon: <FileCheck size={16} className="text-teal-400" />,
    generatePrompt: (level) =>
      `Provide an executive summary of the attached document(s). Break it down into:\n1. Objective / Core Problem\n2. Key Findings & Arguments\n3. Methodologies or Key Modules\n4. Final Conclusion & Recommendations.\n[Depth Level: ${level}]`,
  },
  {
    id: 'generate-questions',
    label: 'Generate Questions (Exam / Viva)',
    shortDesc: 'Viva voce & short/long exam questions with answers',
    icon: <HelpCircle size={16} className="text-rose-400" />,
    generatePrompt: (level) =>
      `Generate a targeted set of EXAM and VIVA VOCE questions directly grounded in the attached files/topic:\n1. 5 Short conceptual questions with model answers\n2. 3 In-depth analytical / problem-solving questions with grading rubrics\n3. 5 Rapid-fire Viva questions with instant answers.\n[Depth Level: ${level}]`,
  },
  {
    id: 'step-by-step',
    label: 'Explain Step-by-Step',
    shortDesc: 'Sequential chronological breakdown of processes',
    icon: <ListOrdered size={16} className="text-orange-400" />,
    generatePrompt: (level) =>
      `Break down the attached concept or process step-by-step in logical chronological sequence. For each step, clearly outline: 1) What happens, 2) Why it happens, and 3) What is the resulting outcome.\n[Depth Level: ${level}]`,
  },
  {
    id: 'revision-notes',
    label: 'Create Revision Notes',
    shortDesc: 'Last-minute cheat sheet, formulas & memory mnemonics',
    icon: <FileText size={16} className="text-purple-400" />,
    generatePrompt: (level) =>
      `Create a last-minute quick revision cheat sheet from the attached files/context. Include: 1) Essential definitions, 2) Key formulas & laws, 3) Acronyms/mnemonics for fast recall, 4) Comparison summary tables, and 5) A checklist of must-remember concepts.\n[Depth Level: ${level}]`,
  },
];

interface QuickActionsMenuProps {
  onSelectAction: (prompt: string, actionName: string) => void;
  disabled?: boolean;
}

export const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({
  onSelectAction,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [level, setLevel] = useState<ExplanationLevel>('Moderate');
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleActionClick = (action: QuickActionItem) => {
    const prompt = action.generatePrompt(level);
    onSelectAction(prompt, action.label);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title="Quick Study & Explanation Actions"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-sm cursor-pointer select-none ${
          isOpen
            ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30'
            : 'bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Zap size={14} className={isOpen ? 'text-white' : 'text-amber-500 dark:text-amber-400'} />
        <span>Quick Actions</span>
        <ChevronDown size={13} className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full mb-2.5 left-0 w-84 sm:w-96 max-h-[480px] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Header & Explanation Level Selector */}
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-600 dark:text-indigo-400" />
                Explanation Depth
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Grounded Prompting</span>
            </div>

            {/* Depth Selector Pills */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              {(['Light', 'Moderate', 'Detailed'] as ExplanationLevel[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    level === l
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {level === l && <CheckCircle2 size={11} />}
                  <span>{l}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Items List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Academic & Study Actions
            </div>

            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handleActionClick(action)}
                className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors group cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 group-hover:scale-105 transition-transform shrink-0 mt-0.5">
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 flex items-center justify-between">
                    <span>{action.label}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-snug">
                    {action.shortDesc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
