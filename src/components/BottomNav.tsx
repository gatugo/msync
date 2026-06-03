'use client';

import { Home, BarChart2, MessageSquare, Settings } from 'lucide-react';

interface BottomNavProps {
    currentTab: 'today' | 'coach' | 'stats' | 'settings';
    onTabChange: (tab: 'today' | 'coach' | 'stats' | 'settings') => void;
    isHidden?: boolean;
}

export default function BottomNav({ currentTab, onTabChange, isHidden = false }: BottomNavProps) {
    const tabs = [
        { id: 'today', label: 'Home', icon: Home },
        { id: 'coach', label: 'Coach', icon: MessageSquare },
        { id: 'stats', label: 'Stats', icon: BarChart2 },
        { id: 'settings', label: 'Settings', icon: Settings },
    ] as const;

    return (
        <nav 
            className={`fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 bg-white/75 dark:bg-slate-950/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 p-1 rounded-full z-50 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-lg shadow-slate-200/25 dark:shadow-black/50 transform ${
                isHidden 
                    ? 'translate-y-28 -translate-x-1/2 opacity-0 scale-90 pointer-events-none' 
                    : 'translate-y-0 -translate-x-1/2 opacity-100 scale-100'
            }`}
        >
            <div className="flex items-center gap-1 sm:gap-1.5 h-10 px-1 relative">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = currentTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`flex items-center gap-1 sm:gap-1.5 py-1.5 px-3 sm:px-4 rounded-full transition-all duration-300 relative group cursor-pointer ${
                                isActive 
                                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/90 dark:bg-indigo-500/10 scale-105 font-bold' 
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:scale-105'
                            }`}
                        >
                            <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-300 group-hover:scale-110" />
                            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${
                                isActive 
                                    ? 'max-w-[55px] sm:max-w-[80px] opacity-100 ml-0.5' 
                                    : 'max-w-0 opacity-0 pointer-events-none'
                            }`}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
