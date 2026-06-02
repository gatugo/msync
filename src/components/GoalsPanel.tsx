'use client';

import { useState } from 'react';
import { Goal } from '@/types';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';

interface GoalsPanelProps {
    goals: Goal[];
    onAddGoal: (title: string, targetDate: string, startTime?: string) => void;
    onEditGoal: (goalId: string, title: string, targetDate: string, startTime?: string) => void;
    onToggleGoal: (goalId: string) => void;
    onDeleteGoal: (goalId: string) => void;
    onBreakdown?: (goal: Goal) => void;
    onClose: () => void;
}

export default function GoalsPanel({
    goals,
    onAddGoal,
    onEditGoal,
    onToggleGoal,
    onDeleteGoal,
    onBreakdown,
    onClose,
}: GoalsPanelProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTitle.trim() && newDate) {
            onAddGoal(newTitle.trim(), newDate, newTime || undefined);
            setNewTitle('');
            setNewDate('');
            setNewTime('');
            setIsAdding(false);
        }
    };

    const startEditing = (goal: Goal) => {
        setEditingId(goal.id);
        setEditTitle(goal.title);
        setEditDate(goal.targetDate);
        setEditTime(goal.startTime || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditTitle('');
        setEditDate('');
        setEditTime('');
    };

    const saveEdit = () => {
        if (editingId && editTitle.trim() && editDate) {
            onEditGoal(editingId, editTitle.trim(), editDate, editTime || undefined);
            cancelEditing();
        }
    };

    const activeGoals = goals.filter((g) => !g.completed);
    const completedGoals = goals.filter((g) => g.completed);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatTime = (timeStr: string) => {
        if (!timeStr) return '';
        try {
            const [hours, minutes] = timeStr.split(':');
            const hour = parseInt(hours);
            if (isNaN(hour)) return timeStr;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${minutes} ${ampm}`;
        } catch (e) {
            return timeStr;
        }
    };

    return (
        <div className="fixed inset-x-0 bottom-0 z-[110] bg-white/95 dark:bg-slate-900/80 backdrop-blur-3xl rounded-t-[2.5rem] border-t border-indigo-500/30 p-6 sm:p-8 flex flex-col h-[95vh] md:h-[93vh] md:w-3/4 md:mx-auto shadow-[0_-20px_50px_-15px_rgba(99,102,241,0.3)] animate-in slide-in-from-bottom-full duration-500 ease-out">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center rounded-2xl shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-500/10">
                        <span className="material-icons-round text-white text-xl">gps_fixed</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold dark:text-white text-slate-900 tracking-tight">Goals</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{activeGoals.length} Active Targets</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isAdding ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 rotate-45' : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-600'}`}
                        title={isAdding ? "Close form" : "Add new goal"}
                    >
                        <span className="material-icons-round text-xl">add</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 text-slate-500 dark:text-slate-400 transition-all group"
                        title="Close Panel"
                    >
                        <span className="material-icons-round text-xl group-hover:rotate-90 transition-transform duration-300">close</span>
                    </button>
                </div>
            </div>

            {/* Add Goal Form */}
            {isAdding && (
                <form onSubmit={handleSubmit} className="mb-6 p-5 bg-indigo-500/5 dark:bg-indigo-500/5 rounded-2xl border border-indigo-500/20 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="relative">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 text-sm">edit</span>
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="What is your goal?"
                            className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <DatePicker
                            value={newDate}
                            onChange={setNewDate}
                            placeholder="Date"
                        />
                        <TimePicker
                            value={newTime}
                            onChange={setNewTime}
                            placeholder="Time"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!newTitle.trim() || !newDate}
                            className="flex-[2] py-3 rounded-xl bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:shadow-none"
                        >
                            Start Journey
                        </button>
                    </div>
                </form>
            )}

            {/* Goals List */}
            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1 pb-2">
                {activeGoals.length === 0 && !isAdding && (
                    <div className="flex flex-col items-center justify-start pt-2 md:pt-3 p-6 text-center animate-in fade-in zoom-in-95 duration-1000">
                        <div className="relative mb-5 group">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 group-hover:bg-indigo-500/30 transition-all duration-700" />
                            <img 
                                src="/empty_goals_premium_1780024512227.png" 
                                alt="No goals" 
                                className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-2xl grayscale-[0.2] hover:grayscale-0 transition-all duration-500"
                            />
                        </div>
                        <h4 className="text-xl font-bold dark:text-white text-slate-900 mb-2 tracking-tight">Your Horizon is Clear</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[280px] leading-relaxed font-medium">
                            Goals give the Adult brain direction and the Child brain purpose. What's your next peak?
                        </p>
                        <button 
                            onClick={() => setIsAdding(true)}
                            className="mt-4 px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <span className="material-icons-round text-lg">add</span>
                            Set New Target
                        </button>
                    </div>
                )}

                {activeGoals.map((goal) => (
                    <div key={goal.id}>
                        {editingId === goal.id ? (
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-indigo-500/30 space-y-4 shadow-xl">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 ml-1">Title</label>
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 ml-1">Target Date</label>
                                        <DatePicker
                                            value={editDate}
                                            onChange={setEditDate}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 ml-1">Optional Time</label>
                                        <TimePicker
                                            value={editTime}
                                            onChange={setEditTime}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button onClick={cancelEditing} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                                    <button onClick={saveEdit} className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 transition-all">Update Target</button>
                                </div>
                            </div>
                        ) : (
                            <div className="group bg-white dark:bg-slate-800/30 backdrop-blur-md p-5 rounded-[1.5rem] flex items-center gap-5 shadow-sm border border-slate-200 dark:border-white/5 hover:border-indigo-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-500 group/item">
                                {/* Goal Icon with ring glow */}
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0 ring-4 ring-indigo-500/10 group-hover:ring-indigo-500/20 group-hover:scale-105 transition-all duration-500">
                                    <span className="material-icons-round text-white text-2xl">gps_fixed</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3
                                        className="font-bold text-slate-900 dark:text-white text-base sm:text-lg truncate cursor-pointer hover:text-indigo-500 transition-colors tracking-tight"
                                        onClick={() => startEditing(goal)}
                                    >
                                        {goal.title}
                                    </h3>
                                    <div className="flex items-center gap-4 mt-2">
                                        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                                            ACTIVE
                                        </span>
                                        <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                                            <span className="material-icons-round text-sm text-indigo-500/60">calendar_today</span>
                                            {formatDate(goal.targetDate)}
                                        </span>
                                        {goal.startTime && (
                                            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                                                <span className="material-icons-round text-sm text-purple-500/60">schedule</span>
                                                {formatTime(goal.startTime)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {onBreakdown && (
                                        <button
                                            onClick={() => onBreakdown(goal)}
                                            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all shadow-sm border border-indigo-500/20 hover:border-indigo-400 group/breakdown"
                                            title="Break down with AI"
                                            aria-label="Break down with AI"
                                            data-testid="breakdown-btn"
                                        >
                                            <span className="material-icons-round text-xl group-hover/breakdown:rotate-12 transition-transform">auto_awesome</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onToggleGoal(goal.id)}
                                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700/30 text-slate-400 hover:bg-green-500 hover:text-white transition-all shadow-sm border border-slate-200 dark:border-white/5 hover:border-green-400 group/check"
                                        title="Mark Complete"
                                    >
                                        <span className="material-icons-round text-2xl group-hover/check:scale-110 transition-transform">check</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Completed Goals Section (Achievements Look) */}
                {completedGoals.length > 0 && (
                    <div className="mt-10 pt-8 border-t border-slate-200 dark:border-white/5">
                        <div className="flex items-center justify-between mb-6 px-1">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Hall of Victory</h4>
                            <span className="text-[10px] font-black bg-green-500 text-white px-3 py-1 rounded-full shadow-lg shadow-green-500/20">{completedGoals.length} ACHIEVED</span>
                        </div>
                        <div className="space-y-4">
                            {completedGoals.map((goal) => (
                                <div key={goal.id} className="group bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-[1.5rem] flex items-center gap-5 opacity-70 hover:opacity-100 transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/5">
                                    {editingId === goal.id ? (
                                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-indigo-500/30 space-y-3 shadow-lg">
                                            <input
                                                type="text"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm dark:text-white"
                                            />
                                            <div className="flex justify-end gap-3">
                                                <button onClick={saveEdit} className="text-xs font-bold text-indigo-500 hover:text-indigo-400 transition-colors uppercase tracking-wider">Save</button>
                                                <button onClick={cancelEditing} className="text-xs font-bold text-slate-400 hover:text-slate-300 transition-colors uppercase tracking-wider">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-shrink-0 relative">
                                                <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500/40 group-hover:text-green-500 transition-all duration-500 group-hover:rotate-12">
                                                    <span className="material-icons-round text-2xl">emoji_events</span>
                                                </div>
                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-[#0f172a]">
                                                    <span className="material-icons-round text-[10px] text-white">check</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3
                                                    className="font-bold text-slate-500 dark:text-slate-500 line-through truncate cursor-pointer hover:text-indigo-400 transition-colors text-base"
                                                    onClick={() => startEditing(goal)}
                                                >
                                                    {goal.title}
                                                </h3>
                                                <div className="flex items-center gap-3 mt-1.5 text-[11px] font-bold text-slate-400/50">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="material-icons-round text-sm">event</span>
                                                        {formatDate(goal.targetDate)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => onToggleGoal(goal.id)}
                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all border border-green-500/20 shadow-sm"
                                                    title="Mark Incomplete"
                                                >
                                                    <span className="material-icons-round text-xl">undo</span>
                                                </button>
                                                <button
                                                    onClick={() => onDeleteGoal(goal.id)}
                                                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-500 hover:text-white text-slate-300/40 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                                                    title="Delete"
                                                >
                                                    <span className="material-icons-round text-xl">delete_outline</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
