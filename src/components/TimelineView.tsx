import { Task, TaskType } from '@/types';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Check, Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutList, Grid } from 'lucide-react';
import { format12h } from '@/lib/datePatterns';

interface TimelineViewProps {
    tasks: Task[];
    onMoveTask: (taskId: string, newStatus: 'TODO' | 'START' | 'DONE') => void;
    onUpdateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'scheduledTime' | 'duration'>>) => void;
    onDeleteTask: (taskId: string) => void;
    onAddTask: (title: string, type: TaskType, date?: string, time?: string, duration?: number) => void;
    onEditTask: (task: Task) => void;
    onRequestCreateTask: (date: string, time: string) => void;
    onScrollDirectionChange?: (isScrollingDown: boolean) => void;
}

const typeConfig: Record<TaskType, { emoji: string; bg: string; border: string; label: string }> = {
    ADULT: { emoji: '🔵', bg: 'bg-blue-500/20', border: 'border-blue-500/50', label: 'Adult' },
    CHILD: { emoji: '🩷', bg: 'bg-pink-500/20', border: 'border-pink-500/50', label: 'Child' },
    REST: { emoji: '🟢', bg: 'bg-green-500/20', border: 'border-green-500/50', label: 'Rest' },
};

const typeClasses: Record<TaskType, string> = {
    ADULT: 'border border-blue-500/25 bg-blue-950/20 shadow-[0_4px_16px_rgba(59,130,246,0.06)] hover:border-blue-500/40 hover:bg-blue-950/30 transition-all duration-300',
    CHILD: 'border border-pink-500/25 bg-pink-950/20 shadow-[0_4px_16px_rgba(236,72,153,0.06)] hover:border-pink-500/40 hover:bg-pink-950/30 transition-all duration-300',
    REST: 'border border-emerald-500/25 bg-emerald-950/20 shadow-[0_4px_16px_rgba(16,185,129,0.06)] hover:border-emerald-500/40 hover:bg-emerald-950/30 transition-all duration-300',
};




type ViewMode = 'day' | 'week' | 'month';

export default function TimelineView({
    tasks,
    onMoveTask,
    onDeleteTask,
    onUpdateTask,
    onAddTask,
    onEditTask,
    onRequestCreateTask,
    onScrollDirectionChange,
}: TimelineViewProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [currentDate, setCurrentDate] = useState(new Date());

    const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

    const lastScrollTopRef = useRef<number>(0);
    const isProgrammaticScrollRef = useRef<boolean>(false);
    const isInitialLoadingRef = useRef<boolean>(false);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (!onScrollDirectionChange) return;
        const scrollTop = e.currentTarget.scrollTop;
        
        // Skip handling scroll events if they are triggered programmatically (e.g. on auto-scroll) or during initial load
        if (isProgrammaticScrollRef.current || isInitialLoadingRef.current) {
            lastScrollTopRef.current = scrollTop;
            return;
        }

        const maxScroll = e.currentTarget.scrollHeight - e.currentTarget.clientHeight;

        // Guard: If the previous scroll position is greater than the current maxScroll,
        // it means the container resized and clamped the scroll position downward.
        // This is an automatic layout adjustment, NOT a user scroll action.
        if (lastScrollTopRef.current > maxScroll) {
            lastScrollTopRef.current = scrollTop;
            return;
        }
        
        // Ignore tiny movements and bounce effects
        if (Math.abs(scrollTop - lastScrollTopRef.current) < 10) return;

        if (scrollTop > lastScrollTopRef.current && scrollTop > 60) {
            // Scrolling down -> hide navbar
            onScrollDirectionChange(true);
        } else if (scrollTop < lastScrollTopRef.current) {
            // Scrolling up -> show navbar
            // If we are at the very bottom, it might be a layout shift, so only show if not clamped to bottom
            if (scrollTop < maxScroll - 10) {
                onScrollDirectionChange(false);
            }
        }
        lastScrollTopRef.current = scrollTop;
    };

    // Reset navbar visibility whenever view mode changes
    useEffect(() => {
        if (onScrollDirectionChange) {
            onScrollDirectionChange(false);
        }
    }, [viewMode, onScrollDirectionChange]);

    // --- Helpers ---
    // format12h imported from utils

    const getDaysInWeek = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // Adjust to Sunday start
        const sunday = new Date(d.setDate(diff));
        const days = [];
        for (let i = 0; i < 7; i++) {
            const next = new Date(sunday);
            next.setDate(sunday.getDate() + i);
            days.push(next);
        }
        return days;
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const lastDay = new Date(year, month + 1, 0);
        const days = [];
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const formatDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // --- Navigation ---
    const navigate = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        if (viewMode === 'day') newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
        else if (viewMode === 'week') newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        else newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        setCurrentDate(newDate);
    };

    const goToday = () => setCurrentDate(new Date());

    // --- Data Preparation ---
    const filteredTasks = useMemo(() => {
        let startDate: Date;
        let endDate: Date;

        if (viewMode === 'day') {
            startDate = new Date(currentDate);
            endDate = new Date(currentDate);
        } else if (viewMode === 'week') {
            const days = getDaysInWeek(currentDate);
            startDate = days[0];
            endDate = days[6];
        } else {
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        }

        const startStr = formatDateKey(startDate);
        const endStr = formatDateKey(endDate);

        return tasks.filter(t => {
            if (!t.scheduledDate) return false;
            return t.scheduledDate >= startStr && t.scheduledDate <= endStr;
        }).slice(0, 500); // Limit to 500 tasks per view
    }, [tasks, currentDate, viewMode]);


    // -- Daily View Logic (Reused) --
    // Generate time slots (every 30 mins) starting from 5 AM to 12:30 AM (next day)
    const timeSlots = useMemo(() => {
        const slots: { key: string; hour: number; minute: number }[] = [];
        const startHour = 5;
        const endHour = 25; // Goes up to 24:30 (12:30 AM next day)
        for (let h = startHour; h < endHour; h++) {
            slots.push({ key: `${h.toString().padStart(2, '0')}:00`, hour: h, minute: 0 });
            slots.push({ key: `${h.toString().padStart(2, '0')}:30`, hour: h, minute: 30 });
        }
        return slots;
    }, []);

    const tasksBySlot = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        // Only for DAY view we strictly group by time on the specific day
        // For Week/Month we use Date keys
        filteredTasks.forEach(task => {
            if (viewMode === 'day' && task.scheduledTime) {
                const [hStr, mStr] = task.scheduledTime.split(':');
                const h = parseInt(hStr);
                const m = parseInt(mStr);

                // Find closest slot
                const slotIndex = timeSlots.findIndex(s => {
                    const slotMin = s.hour * 60 + s.minute;
                    const taskMin = h * 60 + m;
                    return taskMin >= slotMin && taskMin < slotMin + 30;
                });

                if (slotIndex !== -1) {
                    const key = timeSlots[slotIndex].key;
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(task);
                }
            } else if (viewMode !== 'day') {
                // Group by DATE
                const dateKey = task.scheduledDate;
                if (dateKey) {
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(task);
                }
            }
        });
        return grouped;
    }, [filteredTasks, viewMode]);

    // Calculate spans to enable visual merging (Day View Only for now)
    const slotConfigs = useMemo(() => {
        if (viewMode !== 'day') return [];
        const skipSlots = new Set<string>();
        return timeSlots.map((slot, index) => {
            if (skipSlots.has(slot.key)) return { ...slot, isSkipped: true };
            const slotTasks = tasksBySlot[slot.key] || [];
            slotTasks.forEach(task => {
                const duration = task.duration || 30;
                if (duration > 30) {
                    const slotsToSkip = Math.floor(duration / 30) - 1;
                    for (let i = 1; i <= slotsToSkip; i++) {
                        if (index + i < timeSlots.length) skipSlots.add(timeSlots[index + i].key);
                    }
                }
            });
            return { ...slot, isSkipped: false };
        });
    }, [timeSlots, tasksBySlot, viewMode]);


    // --- Actions ---
    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent, slotKey: string, dateKey?: string) => {
        e.preventDefault();
        setDragOverSlot(null);
        const taskId = e.dataTransfer.getData('taskId');
        if (taskId) {
            const updates: Partial<Task> = {};
            if (slotKey) updates.scheduledTime = slotKey;
            if (dateKey) updates.scheduledDate = dateKey;
            onUpdateTask(taskId, updates);
        }
    };

    // Local parser is removed in favor of imported one

    const updateDuration = (taskId: string, minutes: number) => { onUpdateTask(taskId, { duration: minutes }); };


    // --- Formatters ---
    const formatTimeDisplay = (hour: number, minute: number) => {
        const displayHour = hour >= 24 ? hour - 24 : hour;
        const ampm = displayHour >= 12 ? 'PM' : 'AM';
        const h = displayHour % 12 || 12;
        const m = minute === 0 ? '' : `:${minute.toString().padStart(2, '0')}`;
        return `${h}${m} ${ampm}`;
    };

    const getHeaderLabel = (abbreviated = false) => {
        if (viewMode === 'day') {
            if (abbreviated) {
                return currentDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            }
            return currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        }
        if (viewMode === 'week') {
            const days = getDaysInWeek(currentDate);
            return `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        }
        return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    };

    // Auto-scroll current time (Day view only)
    const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
    useEffect(() => {
        if (viewMode !== 'day') return;
        
        // Set loading flag to ignore scroll events during page transition and initial scroll setup
        isInitialLoadingRef.current = true;
        const loadingTimer = setTimeout(() => {
            isInitialLoadingRef.current = false;
        }, 1200);

        setTimeout(() => {
            const now = new Date();
            const h = now.getHours(); const m = now.getMinutes();
            const slotMinute = m < 30 ? 0 : 30;
            const currentKey = `${h.toString().padStart(2, '0')}:${slotMinute.toString().padStart(2, '0')}`;
            const currentEl = slotRefs.current[currentKey];
            if (currentEl && scrollContainerRef.current) {
                const container = scrollContainerRef.current;
                isProgrammaticScrollRef.current = true;
                container.scrollTo({ top: currentEl.offsetTop - container.clientHeight / 2 + currentEl.clientHeight / 2, behavior: 'auto' });
                // Reset the programmatic scroll ref after instant scroll is set
                setTimeout(() => {
                    isProgrammaticScrollRef.current = false;
                }, 100);
            }
        }, 100);

        return () => clearTimeout(loadingTimer);
    }, [viewMode, currentDate]);


    return (
        <div className="bg-slate-800/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-xl flex flex-col h-full flex-1 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-slate-900/40 flex flex-col gap-3 sm:flex-row justify-between sm:items-center shrink-0 relative">
                {/* First Row on Mobile: View toggle and navigation */}
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                    <div className="flex bg-white/5 p-1 rounded-lg shrink-0">
                        <button onClick={() => setViewMode('day')} className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === 'day' ? 'bg-indigo-500 text-white shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/5'}`}><LayoutList className="w-4 h-4" /></button>
                        <button onClick={() => setViewMode('week')} className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === 'week' ? 'bg-indigo-500 text-white shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/5'}`}><CalendarIcon className="w-4 h-4" /></button>
                        <button onClick={() => setViewMode('month')} className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === 'month' ? 'bg-indigo-500 text-white shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/5'}`}><Grid className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => navigate('prev')} className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
                        <button onClick={goToday} className="text-xs font-bold px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/70 hover:text-white transition-all active:scale-95">Today</button>
                        <button onClick={() => navigate('next')} className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all active:scale-90"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>

                {/* Second Row on Mobile: Left aligned date label, and right-aligned Add button */}
                <div className="flex sm:hidden items-center justify-between w-full">
                    <h3 className="text-white font-semibold text-sm leading-none bg-gradient-to-r from-slate-100 to-slate-300 text-transparent bg-clip-text select-none md:hidden">
                        {getHeaderLabel()}
                    </h3>
                    <button
                        onClick={() => {
                            const now = new Date();
                            const pad = (n: number) => String(n).padStart(2, '0');
                            const defaultTime = `${pad(now.getHours())}:${now.getMinutes() < 30 ? '00' : '30'}`;
                            onRequestCreateTask(formatDateKey(currentDate), defaultTime);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/40 hover:text-white shadow-[0_0_15px_rgba(99,102,241,0.08)] active:scale-95 transition-all duration-300 shrink-0 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Task</span>
                    </button>
                </div>

                {/* Mid-screen inline date label (hidden on mobile, visible on tablet, hidden on desktop where center label is used) */}
                <div className="hidden sm:block md:hidden text-white font-semibold text-sm select-none">
                    {getHeaderLabel()}
                </div>

                {/* Centered Date Label for Desktop (md and up) */}
                <h3 className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-bold text-base tracking-wide pointer-events-none bg-gradient-to-r from-slate-100 to-slate-300 text-transparent bg-clip-text select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
                    {getHeaderLabel()}
                </h3>

                {/* Add button for Tablet/Desktop */}
                <button
                    onClick={() => {
                        const now = new Date();
                        const pad = (n: number) => String(n).padStart(2, '0');
                        const defaultTime = `${pad(now.getHours())}:${now.getMinutes() < 30 ? '00' : '30'}`;
                        onRequestCreateTask(formatDateKey(currentDate), defaultTime);
                    }}
                    className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/40 hover:text-white shadow-[0_0_15px_rgba(99,102,241,0.08)] hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:scale-[1.03] active:scale-95 transition-all duration-300 ease-out shrink-0 cursor-pointer"
                >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task</span>
                </button>
            </div>

            {/* Content Area */}
            <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-auto custom-scrollbar relative">

                {/* DAY VIEW */}
                {viewMode === 'day' && (
                    <div className="relative">
                        {slotConfigs.map((slot) => {
                            if (slot.isSkipped) return null;
                            const slotTasks = tasksBySlot[slot.key] || [];
                            const isHalfHour = slot.minute === 30;
                            const maxDuration = Math.max(30, ...slotTasks.map(t => t.duration || 30));
                            const slotsSpan = Math.ceil(maxDuration / 30);
                            const minHeight = isHalfHour ? 60 : 80;

                            // Highlight Logic
                            const now = new Date();
                            const isToday = formatDateKey(currentDate) === formatDateKey(now);
                            const isCurrentHour = isToday && slot.hour === now.getHours();

                            return (
                                <div
                                    key={slot.key}
                                    ref={(el) => { slotRefs.current[slot.key] = el; }}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverSlot(slot.key); }}
                                    onDragLeave={() => setDragOverSlot(null)}
                                    onDrop={(e) => handleDrop(e, slot.key)}
                                    style={{ minHeight: `${minHeight * slotsSpan}px` }}
                                    className={`flex border-b border-white/5 relative ${dragOverSlot === slot.key
                                        ? 'bg-indigo-500/10'
                                        : isCurrentHour
                                            ? 'bg-indigo-500/5 shadow-[inset_4px_0_0_0_#6366f1]'
                                            : isHalfHour
                                                ? 'bg-slate-900/10'
                                                : ''
                                        }`}
                                >
                                    <div className={`w-20 shrink-0 flex flex-col items-center py-4 border-r border-white/5 bg-slate-900/20 text-[11px] uppercase tracking-wider font-bold transition-all ${isCurrentHour ? 'text-indigo-400 bg-indigo-500/10 shadow-[inset_-4px_0_10px_-4px_rgba(99,102,241,0.3)]' : 'text-white/40'}`}>
                                        {formatTimeDisplay(slot.hour, slot.minute)}
                                    </div>
                                    <div className="flex-1 min-w-0 p-2 flex flex-wrap gap-2 content-start">
                                        {slotTasks.map(task => (
                                            <div key={task.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, task.id)}
                                                className={`backdrop-blur-[20px] task-card-hover rounded-xl p-2.5 group flex gap-2 overflow-hidden w-[calc(100%-0.5rem)] sm:w-[calc(50%-0.25rem)] lg:w-[calc(33.333%-0.34rem)] shrink-0 ${typeClasses[task.type]} ${task.status === 'DONE' ? 'opacity-50 grayscale-[0.5]' : ''}`}
                                                style={{ minHeight: `${(task.duration || 30) / 30 * 60}px` }}
                                            >
                                                {/* Inline Complete Button */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onMoveTask(task.id, task.status === 'DONE' ? 'TODO' : 'DONE'); }}
                                                    className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${task.status === 'DONE'
                                                        ? 'bg-green-500 border-green-500 text-white'
                                                        : 'border-white/30 hover:border-green-400 hover:bg-green-500/20 text-transparent hover:text-green-400'
                                                        }`}
                                                    title={task.status === 'DONE' ? 'Mark incomplete' : 'Mark complete'}
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                {/* Task Content */}
                                                <div className="flex-1 cursor-pointer" onClick={() => onEditTask(task)}>
                                                    <div className="flex items-center justify-between gap-1 w-full">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${typeConfig[task.type].bg} ${typeConfig[task.type].border} text-white/90 truncate max-w-[70%]`}>
                                                            {typeConfig[task.type].emoji} {typeConfig[task.type].label}
                                                        </span>
                                                        <span className="text-[10px] text-white/40 font-mono tracking-tight shrink-0 whitespace-nowrap">
                                                            {task.scheduledTime ? format12h(task.scheduledTime) : ''}
                                                        </span>
                                                    </div>
                                                    <span className="font-medium text-white/90 text-sm leading-snug break-words line-clamp-2">
                                                        {task.title}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        <div 
                                            className={`${slotTasks.length > 0 
                                                ? 'w-11 h-11 border border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 rounded-xl shrink-0 flex items-center justify-center transition-all duration-200' 
                                                : 'flex-1 min-h-[40px] border border-dashed border-white/5 hover:border-white/10 hover:bg-white/[0.02] rounded-xl flex items-center justify-center transition-all duration-200'
                                            } group cursor-pointer`}
                                            onClick={() => onRequestCreateTask(formatDateKey(currentDate), slot.key)}
                                        >
                                            <Plus className="w-4 h-4 text-white/15 group-hover:text-white/40 transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}


                {/* WEEK VIEW */}
                {viewMode === 'week' && (
                    <div className="grid grid-cols-7 h-full min-w-[800px]">
                        {getDaysInWeek(currentDate).map((day, i) => {
                            const dayKey = formatDateKey(day);
                            const dayTasks = filteredTasks.filter(t => t.scheduledDate === dayKey);
                            const isToday = dayKey === formatDateKey(new Date());
                            return (
                                <div key={i}
                                    className={`border-r border-white/5 last:border-0 flex flex-col cursor-pointer hover:bg-white/[0.02] ${isToday ? 'bg-white/5' : ''}`}
                                    onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                                >
                                    <div className="p-2 text-center border-b border-white/5">
                                        <div className="text-xs text-white/50 uppercase">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                                        <div className={`text-sm font-bold ${isToday ? 'text-indigo-400' : 'text-white'}`}>{day.getDate()}</div>
                                    </div>
                                    <div className="flex-1 p-1 space-y-2 overflow-y-auto custom-scrollbar">
                                        {dayTasks.map(task => (
                                            <div key={task.id}
                                                className={`p-1.5 rounded text-[10px] border truncate text-white/90 shadow-sm ${typeConfig[task.type].bg} ${typeConfig[task.type].border}`}
                                                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                            >
                                                {typeConfig[task.type].emoji} {task.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* MONTH VIEW */}
                {viewMode === 'month' && (
                    <div className="grid grid-cols-7 auto-rows-fr h-full">
                        {/* Headers */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="p-2 text-center text-xs font-bold text-white/40 border-b border-white/5">{d}</div>
                        ))}
                        {/* Padding for first week */}
                        {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => (
                            <div key={`pad-${i}`} className="border-r border-b border-white/5 bg-slate-900/20" />
                        ))}
                        {getDaysInMonth(currentDate).map((day) => {
                            const dayKey = formatDateKey(day);
                            const dayTasks = filteredTasks.filter(t => t.scheduledDate === dayKey);
                            return (
                                <div key={dayKey}
                                    className="border-r border-b border-white/5 p-1 min-h-[80px] hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                                >
                                    <div className="text-right text-xs text-white/50 mb-1">{day.getDate()}</div>
                                    <div className="space-y-1">
                                        {dayTasks.slice(0, 3).map(task => (
                                            <div key={task.id}
                                                className={`h-1.5 rounded-full w-full ${typeConfig[task.type].bg.replace('/20', '/80')} cursor-pointer`}
                                                title={task.title}
                                                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                            />
                                        ))}
                                        {dayTasks.length > 3 && <div className="text-[9px] text-white/30 text-center">+{dayTasks.length - 3} more</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
