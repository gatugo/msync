'use client';

import React from 'react';

export interface ModeButtonConfig<T extends string> {
    mode: T;
    icon: React.ElementType;
    label: string;
}

interface ModeSelectorProps<T extends string> {
    modes: ModeButtonConfig<T>[];
    currentMode: T;
    onModeChange: (mode: T) => void;
    containerClassName?: string;
    buttonClassName?: string;
    labelVisibilityClass?: string;
    shortLabelVisibilityClass?: string;
}

export default function ModeSelector<T extends string>({
    modes,
    currentMode,
    onModeChange,
    containerClassName = "flex items-center bg-slate-950/50 p-1.5 rounded-2xl border border-white/10 relative overflow-hidden backdrop-blur-md gap-1.5",
    buttonClassName = "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-widest transition-all duration-300 relative z-10 whitespace-nowrap",
    labelVisibilityClass = "hidden sm:inline whitespace-nowrap",
    shortLabelVisibilityClass = "inline sm:hidden whitespace-nowrap"
}: ModeSelectorProps<T>) {
    return (
        <div className={containerClassName}>
            {modes.map(({ mode: btnMode, icon: Icon, label }) => {
                const isActive = currentMode === btnMode;
                return (
                    <button
                        key={btnMode}
                        onClick={() => onModeChange(btnMode)}
                        className={`${buttonClassName} ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        {isActive && (
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 rounded-xl -z-10 animate-in zoom-in-95 duration-200 shadow-[0_4px_15px_rgba(99,102,241,0.35)] border border-white/15" />
                        )}
                        <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'text-white scale-110' : 'scale-100'}`} />
                        <span className={labelVisibilityClass}>{label}</span>
                        <span className={shortLabelVisibilityClass}>{label.split(' ')[0]}</span>
                    </button>
                );
            })}
        </div>
    );
}
