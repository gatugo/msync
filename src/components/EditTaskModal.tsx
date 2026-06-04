'use client';

import { useState, useEffect } from 'react';
import { Task, TaskType, TaskStatus } from '@/types';
import { X, Clock, Calendar, Type, Trash2, Save, PlusCircle, Sparkles, Loader2, Brain, Coffee } from 'lucide-react';
import TimePicker from '@/components/TimePicker';
import DatePicker from '@/components/DatePicker';
import { parseNaturalDateTime } from '@/lib/datePatterns';
import { detectTaskType } from '@/lib/smartLogic';

interface EditTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: Task | null;
    initialDate?: string;
    initialTime?: string;
    onSave: (taskId: string, updates: Partial<Task>) => void;
    onCreate?: (title: string, type: TaskType, date: string, time: string, duration: number) => void;
    onDelete: (taskId: string) => void;
}

const typeConfig: Record<TaskType, { icon: React.ComponentType<{ className?: string }>; iconColor: string; label: string; bg: string }> = {
    ADULT: { icon: Brain, iconColor: 'text-blue-400', label: 'Adult', bg: 'bg-blue-500/20 text-blue-300' },
    CHILD: { icon: Sparkles, iconColor: 'text-pink-400', label: 'Child', bg: 'bg-pink-500/20 text-pink-300' },
    REST: { icon: Coffee, iconColor: 'text-emerald-400', label: 'Rest', bg: 'bg-green-500/20 text-green-300' },
};

const durations = [
    { label: '15m', value: 15 },
    { label: '30m', value: 30 },
    { label: '1h', value: 60 },
    { label: '1.5h', value: 90 },
    { label: '2h', value: 120 },
];

export default function EditTaskModal({ isOpen, onClose, task, initialDate, initialTime, onSave, onCreate, onDelete }: EditTaskModalProps) {
    const [title, setTitle] = useState('');
    const [type, setType] = useState<TaskType>('ADULT');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState(30);
    const [isAILoading, setIsAILoading] = useState(false);

    const isEditing = !!task;

    useEffect(() => {
        if (isOpen) {
            if (task) {
                // Edit Mode
                setTitle(task.title);
                setType(task.type);
                setDate(task.scheduledDate || '');
                setTime(task.scheduledTime || '');
                setDuration(task.duration || 30);
            } else {
                // Create Mode - only reset if not already populated by AI or smart fill
                // This check allows smart fill to persist if re-rendering happens
                if (!title) {
                    setTitle('');
                    setType('ADULT');
                    setDate(initialDate || '');
                    setTime(initialTime || '');
                    setDuration(30);
                }
            }
        }
    }, [isOpen, task, initialDate, initialTime]);

    const handleSmartFill = async () => {
        if (!title.trim()) return;

        setIsAILoading(true);
        try {
            // Use client's local date/time for context
            const now = new Date();
            const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const localTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            const res = await fetch('/api/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'schedule_assist',
                    taskTitle: title,
                    localDate,
                    localTime
                })
            });

            if (!res.ok) throw new Error(`API Error: ${res.status}`);

            const data = await res.json();
            if (data.success && data.response) {
                const suggestion = JSON.parse(data.response);
                
                // Update fields
                if (suggestion.suggestedType) setType(suggestion.suggestedType as TaskType);
                if (suggestion.suggestedDate) setDate(suggestion.suggestedDate);
                if (suggestion.suggestedTime) setTime(suggestion.suggestedTime);
                if (suggestion.duration) setDuration(suggestion.duration);
            }
        } catch (error) {
            console.warn('Smart Fill fallback used due to error:', error);
            
            // === OFFLINE FALLBACK ===
            // If AI fails (offline, rate limit, error), use local regex parser
            const localResult = parseNaturalDateTime(title);
            
            if (localResult.date) setDate(localResult.date);
            if (localResult.time) setTime(localResult.time);
            if (localResult.duration) setDuration(localResult.duration);
            
            setType(detectTaskType(title));

        } finally {
            setIsAILoading(false);
        }
    };

    if (!isOpen) return null;

    const handleSave = () => {
        if (isEditing && task) {
            onSave(task.id, {
                title,
                type,
                scheduledDate: date || undefined,
                scheduledTime: time || undefined,
                duration
            });
        } else if (onCreate) {
            onCreate(
                title,
                type,
                date,
                time,
                duration
            );
        }
        onClose();
    };

    const handleDelete = () => {
        if (task && confirm('Are you sure you want to delete this task?')) {
            onDelete(task.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            {/* Modal Panel */}
            <div 
                className="bg-slate-900 border-t sm:border border-white/10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 sm:duration-200 pb-safe sm:pb-0" 
                onClick={e => e.stopPropagation()}
            >
                
                {/* Mobile Drag Handle */}
                <div className="w-full flex justify-center pt-3 pb-1 sm:hidden bg-slate-800/50" onClick={onClose}>
                   <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-800/50">
                    <h2 className="text-white font-bold text-lg">{isEditing ? 'Edit Task' : 'New Task'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/50 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Title with Smart AI Button */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Task Name</label>
                            {/* AI Helper Hint */}
                             {!isEditing && title.trim().length > 3 && (
                                <button 
                                    onClick={handleSmartFill}
                                    disabled={isAILoading}
                                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors animate-in fade-in"
                                >
                                    {isAILoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                    Auto-Fill
                                </button>
                             )}
                        </div>
                        <div className="relative group">
                            <input
                                type="text"
                                value={title}
                                autoFocus={!isEditing}
                                onChange={(e) => setTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (title.trim()) handleSave();
                                    }
                                }}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition-all"
                                placeholder="What needs to be done? (e.g. 'Gym for 1h')"
                            />
                            {/* In-Input Sparkle Button */}
                            <button
                                onClick={handleSmartFill}
                                disabled={isAILoading || !title.trim()}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                                    title.trim() 
                                    ? 'text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300' 
                                    : 'text-white/10 cursor-not-allowed'
                                }`}
                                title="AI Smart Fill"
                            >
                                {isAILoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Type */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Type</label>
                        <div className="flex gap-2">
                            {(Object.keys(typeConfig) as TaskType[]).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setType(t)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all ${type === t
                                        ? `${typeConfig[t].bg} border-white/20 ring-1 ring-white/20`
                                        : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10'
                                        }`}
                                >
                                    <span className="flex items-center shrink-0">
                                        {(() => {
                                            const Icon = typeConfig[t].icon;
                                            return <Icon className={`w-4 h-4 ${typeConfig[t].iconColor}`} />;
                                        })()}
                                    </span>
                                    <span className="text-sm font-medium">{typeConfig[t].label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Schedule */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Date
                            </label>
                            <DatePicker
                                value={date}
                                onChange={setDate}
                                placeholder="Select date"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Time
                            </label>
                            <TimePicker
                                value={time}
                                onChange={setTime}
                                placeholder="Select time"
                            />
                        </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-1">
                            Duration
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {durations.map((d) => (
                                <button
                                    key={d.value}
                                    onClick={() => setDuration(d.value)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${duration === d.value
                                        ? 'bg-indigo-500 text-white'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    {d.label}
                                </button>
                            ))}
                            <div className="flex items-center gap-2 bg-white/5 px-2 rounded-lg border border-white/5 focus-within:border-indigo-500/50 transition-colors">
                                <input
                                    type="number"
                                    value={duration}
                                    onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                                    className="w-12 bg-transparent py-1.5 text-sm text-white text-center focus:outline-none"
                                />
                                <span className="text-xs text-white/40 pr-1">min</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-slate-800/50 flex justify-between items-center">
                    {isEditing ? (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-colors text-sm font-medium"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    ) : (
                        <div /> // Spacer for flex
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!title.trim()}
                            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                        >
                            {isEditing ? <Save className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                            {isEditing ? 'Save Changes' : 'Create Task'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
