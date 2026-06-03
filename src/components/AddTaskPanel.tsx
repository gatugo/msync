'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X, ChevronDown, Bot, Loader2, Sparkles } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { TaskType } from '@/types';
import TimePicker from './TimePicker';
import DatePicker from './DatePicker';
import Portal from './Portal';
import { parseNaturalDateTime, format12h } from '@/lib/datePatterns';
import { detectTaskType } from '@/lib/smartLogic';

interface AddTaskPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (title: string, type: TaskType, date?: string, time?: string, duration?: number) => void;
}

const typeConfig: Record<TaskType, { emoji: string; label: string; color: string }> = {
    ADULT: { emoji: '🔵', label: 'Adult', color: 'bg-blue-500' },
    CHILD: { emoji: '🩷', label: 'Child', color: 'bg-pink-500' },
    REST: { emoji: '🟢', label: 'Rest', color: 'bg-green-500' },
};

const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function AddTaskPanel({ isOpen, onClose, onAdd }: AddTaskPanelProps) {
    const [title, setTitle] = useState('');
    const [type, setType] = useState<TaskType>('ADULT');
    const [date, setDate] = useState(getLocalDateString());
    const [time, setTime] = useState('');
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const [isAILoading, setIsAILoading] = useState(false);
    const [aiError, setAIError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const typeButtonRef = useRef<HTMLButtonElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    // Get tasks from store for AI context
    const tasks = useStore((state) => state.tasks);
    const preferences = useStore((state) => state.preferences);

    // Auto-focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Calculate position for Type Dropdown (Portal-based)
    useEffect(() => {
        const updatePosition = () => {
            if (isTypeDropdownOpen && typeButtonRef.current) {
                const rect = typeButtonRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX
                });
            }
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isTypeDropdownOpen]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!title.trim()) return;

        const today = getLocalDateString();

        // Always use fast Local Smart Logic for submit
        // AI is still accessible explicitly via the Sparkles button (handleSmartAdd)
        const parsed = parseNaturalDateTime(title);
        const finalDate = (date && date !== today) ? date : (parsed.date || date);
        const finalTime = time || parsed.time;
        // Use detected type only if user left it on default 'ADULT', or maybe detectTaskType
        // Actually detectTaskType isn't used in the original handleSubmit, let's use it for extra smartness
        const localType = type === 'ADULT' ? detectTaskType(title) : type;

        onAdd(title.trim(), localType, finalDate || undefined, finalTime || undefined, parsed.duration);
        setTitle('');
        setDate(today);
        setTime('');
        setAIError(null);
        onClose();
    };

    // AI-Assisted Scheduling (Smart Add) - Kept for the manual sparkles button
    const handleSmartAdd = async () => {
        if (!title.trim()) {
            setAIError('Enter a task description first!');
            return;
        }

        setIsAILoading(true);
        setAIError(null);

        try {
            if (preferences.aiEnabled === false) {
                throw new Error('OFFLINE_MODE');
            }

            // Capture Local Time context
            const now = new Date();
            const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const localTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch('/api/coach', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    mode: 'schedule_assist',
                    taskTitle: title.trim(),
                    localDate,
                    localTime,
                    // Send tasks for conflict detection (simplified to save bandwidth/tokens)
                    tasks: tasks.map(t => ({
                        scheduledDate: t.scheduledDate,
                        scheduledTime: t.scheduledTime,
                        duration: t.duration,
                        status: t.status
                    })),
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'AI request failed');
            }

            let jsonStr = data.response;
            // Robust JSON extraction
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            const suggestion = JSON.parse(jsonStr);


            const newType = (suggestion.suggestedType && ['ADULT', 'CHILD', 'REST'].includes(suggestion.suggestedType))
                ? suggestion.suggestedType
                : 'ADULT';
            const newDate = suggestion.suggestedDate || getLocalDateString();
            const newTime = suggestion.suggestedTime;

            // Auto-fill fields instead of submitting
            setType(newType as TaskType);
            setDate(newDate);
            if (newTime) setTime(newTime);

            // Show success feedback briefly
            setAIError('✨ Details auto-filled! Review and add.');
            setTimeout(() => setAIError(null), 3000);

        } catch (error) {
            console.error('AI Smart Add error:', error);

            // Local Regex Fallback when API fails (e.g. Rate Limits)
            // console.log('Using local fallback parsing...');
            const parsed = parseNaturalDateTime(title);

            if (parsed.date || parsed.time || parsed.duration) {
                // Apply local parsed values
                const today = getLocalDateString();
                setDate(parsed.date || today);
                if (parsed.time) setTime(parsed.time);
                setType(detectTaskType(title));

                setAIError('✨ Offline mode: Details auto-detected.');
                setTimeout(() => setAIError(null), 3000);
            } else {
                // Fallback gracefully without showing scary "All AI services busy" error
                setAIError('⚡ Offline Mode: Please set time manually.');
                setTimeout(() => setAIError(null), 3000);
            }
        } finally {
            setIsAILoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop - click to close */}
            <div
                className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200"
                onClick={onClose}
            />

            <div className="fixed top-[81px] left-0 right-0 z-[70] flex justify-center px-4 animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none">
                <div
                    className="w-full max-w-md pointer-events-auto bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)] ring-1 ring-white/10 relative overflow-visible group"
                    onClick={(e) => e.stopPropagation()}
                >

                    {/* Close Button (subtle) */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }}
                        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 pt-2">
                        {/* Main Input */}
                        <div className="relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={title}
                                onChange={(e) => { setTitle(e.target.value); setAIError(null); }}
                                placeholder="Type to add (e.g., 'Gym at 5pm')..."
                                className="w-full bg-transparent text-xl sm:text-2xl font-semibold text-white placeholder:text-white/30 focus:outline-none py-2 pr-16 leading-relaxed"
                            />
                            {/* Inside-Input Sparkle Button */}
                            <button
                                type="button"
                                onClick={handleSmartAdd}
                                disabled={isAILoading || !title.trim()}
                                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-0 disabled:pointer-events-none"
                                title="Auto-fill details with AI"
                            >
                                {isAILoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* AI Error Message */}
                        {aiError && (
                            <div className={`text-xs px-3 py-1.5 font-medium animate-in fade-in slide-in-from-top-1 rounded-lg border ${aiError.includes('✨') ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                                {aiError}
                            </div>
                        )}

                        {/* Natural Language Preview (Smart Detection) */}
                        {title.trim() && !aiError && (() => {
                            const parsed = parseNaturalDateTime(title);
                            if (parsed.date || parsed.time || parsed.duration) {
                                return (
                                    <div className="text-xs text-indigo-300/80 flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 animate-in fade-in slide-in-from-top-1">
                                        <Sparkles className="w-3 h-3" />
                                        <span>
                                            Detected:
                                            {parsed.date && ` ${new Date(parsed.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                                            {parsed.date && parsed.time && ' @'}
                                            {parsed.time && ` ${format12h(parsed.time)}`}
                                            {parsed.duration && ` (${parsed.duration} mins)`}
                                        </span>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {/* Details Section - Responsive Layout */}
                        <div className="flex flex-col gap-3 sm:gap-5">
                            {/* Row 1: Type, Date, Time */}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                {/* Type Selector - uses Portal to escape stacking context */}
                                <div className="relative">
                                    <button
                                        ref={typeButtonRef}
                                        type="button"
                                        onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                        className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-white/5 hover:border-white/10 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-white/90 transition-all font-medium"
                                    >
                                        <span>{typeConfig[type].emoji}</span>
                                        <span>{typeConfig[type].label}</span>
                                        <ChevronDown className="w-3 h-3 text-white/50" />
                                    </button>

                                    {isTypeDropdownOpen && (
                                        <Portal>
                                            {/* Invisible backdrop to catch outside clicks */}
                                            <div
                                                className="fixed inset-0 z-[9990]"
                                                onClick={(e) => { e.stopPropagation(); setIsTypeDropdownOpen(false); }}
                                            />
                                            {/* Dropdown menu rendered at document.body level */}
                                            <div
                                                className="fixed z-[9999] bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[140px] animate-in fade-in zoom-in-95 duration-100 p-1"
                                                style={{ top: coords.top, left: coords.left }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {(Object.keys(typeConfig) as TaskType[]).map((t) => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setType(t);
                                                            setIsTypeDropdownOpen(false);
                                                        }}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg text-sm transition-colors ${type === t ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                                                    >
                                                        <span>{typeConfig[t].emoji}</span>
                                                        <span className="font-medium">{typeConfig[t].label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </Portal>
                                    )}
                                </div>

                                <div className="hidden sm:block h-5 w-px bg-white/10" />

                                {/* Date Picker Wrapper */}
                                <div className="flex-1 min-w-[110px] sm:min-w-[120px] max-w-[140px]">
                                    <DatePicker value={date} onChange={setDate} placeholder="Today" />
                                </div>

                                {/* Time Picker Wrapper */}
                                <div className="flex-1 min-w-[90px] sm:min-w-[100px] max-w-[120px]">
                                    <TimePicker value={time} onChange={setTime} placeholder="Any time" />
                                </div>
                            </div>

                            {/* Row 2: Add Task Button (Full Width) */}
                            <button
                                type="submit"
                                disabled={!title.trim() || isAILoading}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 border border-white/5 shadow-lg shadow-black/20"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="whitespace-nowrap">Add Task</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>

    );
}
