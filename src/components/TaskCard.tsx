'use client';

import { useState } from 'react';
import { Task, TaskType } from '@/types';
import { MoreHorizontal, ArrowLeft, ArrowRight, Edit2, Trash2 } from 'lucide-react';

interface TaskCardProps {
    task: Task;
    onMoveForward?: () => void;
    onMoveBack?: () => void;
    onDelete: () => void;
    onEdit: () => void;
    isDone?: boolean;
}

const typeConfig: Record<TaskType, { color: string; bgColor: string; label: string }> = {
    ADULT: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'ADULT' },
    CHILD: { color: 'text-pink-500', bgColor: 'bg-pink-500/10', label: 'CHILD' },
    REST: { color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'REST' },
};

const format12h = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    const displayM = m.toString().padStart(2, '0');
    return `${displayH}:${displayM} ${ampm}`;
};

const getTodayString = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function TaskCard({
    task,
    onMoveForward,
    onMoveBack,
    onDelete,
    onEdit,
    isDone = false,
}: TaskCardProps) {
    const config = typeConfig[task.type];
    const [isExpanded, setIsExpanded] = useState(false);
    
    const today = getTodayString();
    const isOverdue = task.scheduledDate && task.scheduledDate < today && !isDone;

    return (
        <div
            onDoubleClick={onEdit}
            onClick={() => setIsExpanded(!isExpanded)}
            onMouseLeave={() => setIsExpanded(false)}
            className={`task-card-hover group relative p-5 rounded-2xl cursor-pointer transition-all duration-300 shadow-xl backdrop-blur-md
                glass-panel
                ${task.type === 'ADULT' && !isOverdue ? 'neon-border-blue' : ''}
                ${task.type === 'CHILD' && !isOverdue ? 'neon-border-pink' : ''}
                ${task.type === 'REST' && !isOverdue ? 'neon-border-green' : ''}
                ${isOverdue ? 'neon-border-red border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}
                ${isDone ? 'opacity-50 grayscale-[0.6] blur-[0.5px]' : 'opacity-100'}
            `}
        >
            {/* Header: Badge & Date */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    {isOverdue && (
                        <span className="text-[10px] font-bold tracking-widest uppercase text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                            OVERDUE
                        </span>
                    )}
                    <span className="text-[10px] font-bold tracking-widest uppercase text-white/50">{config.label}</span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Mobile "More" Indicator - visible only on small screens when not expanded */}
                    <span className={`sm:hidden text-slate-600 transition-opacity ${isExpanded ? 'opacity-0' : 'opacity-100'}`}>
                        <MoreHorizontal className="w-4 h-4" />
                    </span>

                    {(task.scheduledDate || task.scheduledTime) && (
                        <span className={`text-[10px] font-medium ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                            {task.scheduledDate && (
                                <>
                                    {new Date(task.scheduledDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </>
                            )}
                            {task.scheduledTime && (
                                <> • {format12h(task.scheduledTime)}</>
                            )}
                        </span>
                    )}
                </div>
            </div>

            {/* Content: Title */}
            <p className={`text-sm font-medium leading-relaxed text-slate-300 ${isDone ? 'line-through' : ''}`}>
                {task.title}
            </p>

            {/* Actions Footer */}
            <div className={`flex gap-2 mt-4 justify-end transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}>
                {onMoveBack && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveBack(); }}
                        className="p-1.5 bg-slate-800 rounded-lg text-slate-500 hover:text-[#5c67ff] transition-colors"
                        title="Move back"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                )}

                {onMoveForward && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveForward(); }}
                        className="p-1.5 bg-slate-800 rounded-lg text-slate-500 hover:text-[#5c67ff] transition-colors"
                        title="Move forward"
                    >
                        <ArrowRight className="w-4 h-4" />
                    </button>
                )}

                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="p-1.5 bg-slate-800 rounded-lg text-slate-500 hover:text-[#5c67ff] transition-colors"
                    title="Edit task"
                >
                    <Edit2 className="w-4 h-4" />
                </button>

                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 bg-slate-800 rounded-lg text-slate-500 hover:text-red-500 transition-colors"
                    title="Delete task"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
