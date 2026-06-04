'use client';

import { useState } from 'react';
import { Task, TaskStatus } from '@/types';
import TaskCard from '@/components/TaskCard';
import { ListTodo, Zap, CheckCircle2, PlusCircle, Hourglass, Plus } from 'lucide-react';

interface CollapsibleColumnProps {
    title: string;
    status: TaskStatus;
    tasks: Task[];
    onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
    onDeleteTask: (taskId: string) => void;
    onEditTask: (task: Task) => void;
    onAddTask: () => void;
}

const statusConfig = {
    TODO: {
        label: 'To Do',
        icon: ListTodo,
        iconBg: 'bg-blue-100 dark:bg-blue-500/20',
        iconColor: 'text-blue-600 dark:text-blue-400',
        countBg: 'bg-slate-200 dark:bg-slate-800',
        countColor: 'text-slate-600 dark:text-slate-400',
        columnBg: 'bg-slate-500/5 border-slate-700/30',
    },
    START: {
        label: 'In Progress',
        icon: Zap,
        iconBg: 'bg-amber-100 dark:bg-amber-500/20',
        iconColor: 'text-amber-600 dark:text-amber-400',
        countBg: 'bg-amber-100 dark:bg-amber-900/40',
        countColor: 'text-amber-700 dark:text-amber-400',
        columnBg: 'bg-amber-500/5 border-amber-500/10',
    },
    DONE: {
        label: 'Done',
        icon: CheckCircle2,
        iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        countBg: 'bg-emerald-100 dark:bg-emerald-900/40',
        countColor: 'text-emerald-700 dark:text-emerald-400',
        columnBg: 'bg-emerald-500/5 border-emerald-500/10',
    },
};

const getNextStatus = (current: TaskStatus): TaskStatus | null => {
    if (current === 'TODO') return 'START';
    if (current === 'START') return 'DONE';
    return null;
};

const getPrevStatus = (current: TaskStatus): TaskStatus | null => {
    if (current === 'DONE') return 'START';
    if (current === 'START') return 'TODO';
    return null;
};

export default function CollapsibleColumn({
    title,
    status,
    tasks,
    onMoveTask,
    onDeleteTask,
    onEditTask,
    onAddTask,
}: CollapsibleColumnProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const config = statusConfig[status];
    const count = tasks.length;
    const StatusIcon = config.icon;

    const handleMoveForward = (taskId: string) => {
        const nextStatus = getNextStatus(status);
        if (nextStatus) {
            onMoveTask(taskId, nextStatus);
        }
    };

    const handleMoveBack = (taskId: string) => {
        const prevStatus = getPrevStatus(status);
        if (prevStatus) {
            onMoveTask(taskId, prevStatus);
        }
    };

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const taskId = e.dataTransfer.getData('taskId');
        if (taskId) {
            onMoveTask(taskId, status);
        }
    };

    return (
        <div
            className={`flex flex-col h-full glass-panel rounded-3xl transition-all duration-300 ${isDragOver ? 'ring-2 ring-[#5c67ff] scale-[1.01]' : ''}`}
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
        >
            {/* Sticky Header */}
            <div className="flex items-center justify-between p-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${config.iconBg} flex items-center justify-center ${config.iconColor}`}>
                        <StatusIcon className="w-4.5 h-4.5" />
                    </div>
                    <h2 className="font-bold text-slate-200 tracking-tight">{title}</h2>
                    <span className={`${config.countBg} ${config.countColor} text-[10px] px-2 py-0.5 rounded-full font-bold`}>
                        {count}
                    </span>
                </div>
                <button
                    onClick={onAddTask}
                    className="p-1 text-slate-400 hover:text-[#5c67ff] transition-colors cursor-pointer"
                >
                    <PlusCircle className="w-5 h-5" />
                </button>
            </div>

            {/* Scrollable Tasks Area */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 space-y-3 ${isDragOver ? 'bg-white/[0.02]' : ''}`}>
                {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[140px] text-slate-500 text-center py-8">
                        <Hourglass className="w-8 h-8 mb-2 opacity-20 text-slate-400" />
                        <p className="text-xs">No tasks here yet</p>
                    </div>
                ) : (
                    tasks.map((task) => (
                        <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            className="flex-shrink-0"
                        >
                            <TaskCard
                                task={task}
                                isDone={status === 'DONE'}
                                onMoveForward={
                                    getNextStatus(status) ? () => handleMoveForward(task.id) : undefined
                                }
                                onMoveBack={
                                    getPrevStatus(status) ? () => handleMoveBack(task.id) : undefined
                                }
                                onDelete={() => onDeleteTask(task.id)}
                                onEdit={() => onEditTask(task)}
                            />
                        </div>
                    ))
                )}
            </div>

            {/* Quick Add Footer */}
            <div className="p-3 pt-0 flex-shrink-0">
                <button
                    onClick={onAddTask}
                    className="w-full py-2.5 rounded-2xl border border-dashed border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-[#5c67ff]/40 hover:bg-[#5c67ff]/5 transition-all text-xs font-medium flex items-center justify-center gap-2 group cursor-pointer"
                >
                    <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    Add Task
                </button>
            </div>
        </div>
    );
}
