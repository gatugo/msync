'use client';

import { LayoutGrid, Clock } from 'lucide-react';

interface ViewToggleProps {
    view: 'kanban' | 'timeline';
    onViewChange: (view: 'kanban' | 'timeline') => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
    return (
        <div className="inline-flex p-1 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <button
                onClick={() => onViewChange('kanban')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all text-sm font-semibold cursor-pointer ${view === 'kanban'
                        ? 'bg-[#5c67ff] text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                <LayoutGrid className="w-4.5 h-4.5" />
                <span>Kanban</span>
            </button>
            <button
                onClick={() => onViewChange('timeline')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all text-sm font-semibold cursor-pointer ${view === 'timeline'
                        ? 'bg-[#5c67ff] text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                <Clock className="w-4.5 h-4.5" />
                <span>Timeline</span>
            </button>
        </div>
    );
}
