'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { useRouter } from 'next/navigation';
import TimePicker from './TimePicker';
import { Database, FlaskConical, User, Key, Brain, CloudOff, ChevronDown, Shield, Bot, PowerOff, Layers, WifiOff, Moon, Gamepad2, Sparkles, Heart, Briefcase, XCircle, ChevronRight, Upload, Download, Trash2, AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function DataLabIcon({ className = "w-6 h-6", isLarge = false }: { className?: string; isLarge?: boolean }) {
    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            {/* Outer glowing background ring with pulsing gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-20 blur-md ${isLarge ? 'animate-pulse' : ''}`} />
            
            {/* Beautiful, futuristic combined icon design */}
            <div className="relative z-10 flex items-center justify-center">
                {/* Database icon as the back layer / structure */}
                <Database className={`text-indigo-400 stroke-[1.5] ${isLarge ? 'w-10 h-10 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'w-6 h-6 drop-shadow-[0_0_4px_rgba(99,102,241,0.4)]'}`} />
                
                {/* Laboratory beaker overlaid with modern glassmorphism aesthetic */}
                <div className={`absolute ${isLarge ? 'translate-x-2.5 translate-y-2.5' : 'translate-x-1.5 translate-y-1.5'}`}>
                    <div className="flex items-center justify-center rounded-lg bg-slate-900/90 border border-indigo-500/30 p-1 shadow-lg backdrop-blur-md">
                        <FlaskConical className={`text-pink-400 stroke-[2] ${isLarge ? 'w-5 h-5' : 'w-3.5 h-3.5'}`} />
                    </div>
                </div>
            </div>
        </div>
    );
}

interface SettingsTabProps {
    handleImport: () => void;
    handleExport: () => void;
    onScrollDirectionChange?: (isHidden: boolean) => void;
}

export default function SettingsTab({ handleImport, handleExport, onScrollDirectionChange }: SettingsTabProps) {
    const [user, setUser] = useState<any>(null);
    const [showDataModal, setShowDataModal] = useState(false);
    const router = useRouter();
    const { preferences, updatePreferences, resetStore, clearAllData } = useStore();

    const [tempPrefs, setTempPrefs] = useState(preferences);
    const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);

    const lastScrollTopRef = useRef<number>(0);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (!onScrollDirectionChange) return;
        const scrollTop = e.currentTarget.scrollTop;
        const maxScroll = e.currentTarget.scrollHeight - e.currentTarget.clientHeight;

        // Guard: If the previous scroll position is greater than the current maxScroll,
        // it means the container resized and clamped the scroll position downward.
        // This is an automatic layout adjustment, NOT a user scroll action.
        if (lastScrollTopRef.current > maxScroll) {
            lastScrollTopRef.current = scrollTop;
            return;
        }

        if (Math.abs(scrollTop - lastScrollTopRef.current) < 10) return;
        if (scrollTop > lastScrollTopRef.current && scrollTop > 60) {
            onScrollDirectionChange(true);
        } else if (scrollTop < lastScrollTopRef.current) {
            if (scrollTop < maxScroll - 10) {
                onScrollDirectionChange(false);
            }
        }
        lastScrollTopRef.current = scrollTop;
    };

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    // Keep tempPrefs in sync with store when it hydrates
    useEffect(() => {
        setTempPrefs(preferences);
    }, [preferences]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        resetStore();
        setUser(null);
        router.refresh();
    };

    const handleSavePrefs = () => {
        updatePreferences(tempPrefs);
    };

    const handleAddTag = (key: 'hobbies' | 'interests' | 'passions' | 'work', value: string) => {
        if (!value.trim()) return;
        setTempPrefs(prev => ({
            ...prev,
            [key]: [...(prev[key] || []), value.trim()]
        }));
    };

    const handleRemoveTag = (key: 'hobbies' | 'interests' | 'passions' | 'work', index: number) => {
        setTempPrefs(prev => ({
            ...prev,
            [key]: prev[key].filter((_, i) => i !== index)
        }));
    };

    return (
        <div 
            onScroll={handleScroll}
            className="h-full p-4 sm:p-6 relative overflow-y-auto custom-scrollbar scroll-smooth"
        >
            <div className="max-w-5xl mx-auto w-full space-y-6 pb-20 sm:pb-24">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h2>
                </div>

            {/* Account Panel (Premium Hub Look) */}
            <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-2xl p-6 rounded-2xl relative overflow-hidden group border border-slate-200/50 dark:border-white/10 shadow-xl shadow-indigo-500/5 glow-card-hover">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-30" />

                {user ? (
                    <div className="space-y-6 relative">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl blur-[6px] opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all duration-500 animate-pulse" />
                                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-xl transition-transform group-hover:scale-105 duration-300 border border-white/20">
                                    {user.email?.[0].toUpperCase()}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Active Member</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate font-medium">{user.email}</p>
                                <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-md">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Synced</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full py-3 bg-slate-50 dark:bg-white/[0.02] hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 text-slate-600 dark:text-slate-400 rounded-xl transition-all font-bold text-xs uppercase tracking-widest border border-slate-200 dark:border-white/10 shadow-sm"
                        >
                            Log Out Session
                        </button>
                    </div>
                ) : (
                    <div className="text-center space-y-5 relative py-2">
                        <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-3xl mx-auto flex items-center justify-center shadow-inner relative group-hover:rotate-3 transition-transform duration-500">
                            <User className="text-slate-400 dark:text-slate-600 w-12 h-12" />
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-500 rounded-xl border-4 border-white dark:border-[#0f172a] flex items-center justify-center text-white">
                                <Key className="w-4 h-4" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Guest Profile</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-[200px] mx-auto leading-relaxed font-medium">Connect an account to enable multi-device sync and cloud backups.</p>
                        </div>
                        <Link
                            href="/login"
                            className="inline-block w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white rounded-xl transition-all font-bold text-sm shadow-xl shadow-indigo-500/30 active:scale-[0.98]"
                        >
                            Sign In / Get Started
                        </Link>
                    </div>
                )}
            </div>

            {/* Brain Personalization (Glass Accordion) */}
            <div className={`bg-white/50 dark:bg-slate-900/40 backdrop-blur-2xl rounded-2xl overflow-hidden transition-all duration-500 border border-slate-200/50 dark:border-white/10 glow-card-hover ${isPersonalizationOpen ? 'shadow-2xl shadow-indigo-500/10' : ''}`}>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsPersonalizationOpen(!isPersonalizationOpen)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setIsPersonalizationOpen(!isPersonalizationOpen);
                        }
                    }}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer select-none"
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${isPersonalizationOpen ? 'bg-indigo-500 text-white shadow-indigo-500/40 rotate-[360deg]' : 'bg-indigo-500/10 text-indigo-500'}`}>
                            <Brain className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-slate-900 dark:text-white tracking-tight">Brain Personalization</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Fine-tune your AI Coach behavior</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Save Indicator */}
                        {(tempPrefs !== preferences) && (
                            <button
                                type="button"
                                id="settings-save-button"
                                onClick={(e) => { e.stopPropagation(); handleSavePrefs(); }}
                                className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/30 animate-pulse hover:bg-indigo-600 transition-all cursor-pointer mr-1 active:scale-95 border-none outline-none"
                            >
                                <span className="text-[10px] font-black uppercase tracking-widest">Save</span>
                            </button>
                        )}

                        {!user && (
                            <div className="hidden xs:flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">
                                    Local
                                </span>
                            </div>
                        )}

                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-500 ${isPersonalizationOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>

                <div className={`transition-[max-height,opacity] duration-500 ease-in-out ${isPersonalizationOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-6 pt-0 border-t border-slate-200/50 dark:border-white/5 space-y-8">

                        {/* Guest Warning */}
                        {!user && (
                            <div className="mt-5 p-4 bg-indigo-500/[0.03] dark:bg-amber-500/[0.03] border border-amber-500/20 rounded-2xl flex gap-4 items-center">
                                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                    <Shield className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Offline Personalization</p>
                                    <p className="text-[10px] text-slate-500 dark:text-amber-200/50 leading-relaxed font-medium">
                                        Data is stored in this browser session. <Link href="/login" className="text-amber-500 underline decoration-amber-500/30 underline-offset-4 hover:decoration-amber-500 transition-all font-bold">Sign in</Link> to secure your cloud brain.
                                    </p>
                                </div>
                            </div>
                        )}


                        {/* Premium AI & Offline Toggle */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between p-5 bg-white/5 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${tempPrefs.aiEnabled ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/30 ring-2 ring-indigo-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 ring-1 ring-slate-300 dark:ring-white/5'}`}>
                                        {tempPrefs.aiEnabled ? (
                                            <Bot className="w-6 h-6" />
                                        ) : (
                                            <PowerOff className="w-6 h-6" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            Enable AI Intelligence
                                            {tempPrefs.aiEnabled && <span className="flex w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />}
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                            {tempPrefs.aiEnabled ? 'Using AI for advanced insight' : 'Using Local Smart Logic only'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setTempPrefs(p => ({ ...p, aiEnabled: !p.aiEnabled }))}
                                    className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 shadow-inner shrink-0 ${tempPrefs.aiEnabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${tempPrefs.aiEnabled ? 'translate-x-6 scale-110' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Auto Arrange Toggle */}
                            <div className={`flex items-center justify-between p-4 bg-white/5 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/5 transition-all ${tempPrefs.aiEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400">
                                        <Layers className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            Auto-Arrange Tasks
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                            {tempPrefs.autoArrangeTasks ? 'AI will automatically adjust timeline' : 'AI only suggests changes (Requires confirmation)'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setTempPrefs(p => ({ ...p, autoArrangeTasks: !p.autoArrangeTasks }))}
                                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 shadow-inner shrink-0 ${tempPrefs.autoArrangeTasks ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ${tempPrefs.autoArrangeTasks ? 'translate-x-6 scale-110' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Force Offline Toggle */}
                            <div className="flex items-center justify-between p-4 bg-white/5 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/5 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-500">
                                        <WifiOff className="w-5 h-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            Force Offline Mode
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                            {tempPrefs.forceOfflineMode ? 'Always using Smart Logic' : 'Auto-switch based on connection'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setTempPrefs(p => ({ ...p, forceOfflineMode: !p.forceOfflineMode }))}
                                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 shadow-inner shrink-0 ${tempPrefs.forceOfflineMode ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ${tempPrefs.forceOfflineMode ? 'translate-x-6 scale-110' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Sleep Schedule */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                <Moon className="w-4 h-4 text-indigo-400" />
                                Optimization Window
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 bg-slate-50 dark:bg-black/10 p-3 rounded-2xl border border-slate-200 dark:border-white/5">
                                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest ml-1">Sleep At</span>
                                    <TimePicker
                                        value={tempPrefs.sleepStartTime || '23:00'}
                                        onChange={(val) => setTempPrefs(p => ({ ...p, sleepStartTime: val }))}
                                    />
                                </div>
                                <div className="space-y-2 bg-slate-50 dark:bg-black/10 p-3 rounded-2xl border border-slate-200 dark:border-white/5">
                                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest ml-1">Wake Up</span>
                                    <TimePicker
                                        value={tempPrefs.sleepEndTime || '07:00'}
                                        onChange={(val) => setTempPrefs(p => ({ ...p, sleepEndTime: val }))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Tags Sections */}
                        {(['work', 'hobbies', 'interests', 'passions'] as const).map((key) => (
                            <div key={key} className="space-y-4">
                                <label className="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                    {(() => {
                                        const iconClass = `w-4 h-4 ${key === 'passions' ? 'text-rose-500' : key === 'work' ? 'text-blue-500' : key === 'hobbies' ? 'text-indigo-500' : 'text-amber-500'}`;
                                        if (key === 'hobbies') return <Gamepad2 className={iconClass} />;
                                        if (key === 'interests') return <Sparkles className={iconClass} />;
                                        if (key === 'passions') return <Heart className={iconClass} />;
                                        return <Briefcase className={iconClass} />;
                                    })()}
                                    {key === 'work' ? 'Work & Skills' : key}
                                </label>
                                <div className="flex flex-wrap gap-2 bg-slate-50/50 dark:bg-black/20 p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                                    {(tempPrefs[key] || []).map((tag, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-white/10 group hover:border-indigo-500/40 transition-all"
                                        >
                                            {tag}
                                            <button
                                                onClick={() => handleRemoveTag(key, i)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <XCircle className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <input
                                        type="text"
                                        placeholder={`+ Add ${key === 'work' ? 'Work' : key === 'hobbies' ? 'Hobby' : key === 'interests' ? 'Interest' : 'Passion'}`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleAddTag(key, (e.target as HTMLInputElement).value);
                                                (e.target as HTMLInputElement).value = '';
                                            }
                                        }}
                                        className="bg-transparent px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 min-w-[120px] font-bold"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Data Management (Glass Action Card) */}
            <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-2xl rounded-2xl border border-slate-200/50 dark:border-white/10 overflow-hidden group glow-card-hover transition-all">
                <button
                    onClick={() => setShowDataModal(true)}
                    className="flex items-center justify-between w-full p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-slate-800/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
                            <DataLabIcon className="w-8 h-8" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-slate-900 dark:text-white tracking-tight">Data Management</h3>
                            {!user ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[9px] text-amber-500 font-black uppercase tracking-widest px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">Backup Required</span>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Export or restore your cloud brain</p>
                            )}
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-slate-100 dark:group-hover:bg-white/5 transition-all">
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                </button>
            </div>

            {/* App Footer Branding */}
            <div className="text-center pt-8 pb-2 mt-12 border-t border-slate-200/40 dark:border-white/5 opacity-60 hover:opacity-100 transition-opacity duration-500">
                <div className="flex items-center justify-center gap-2 mb-1.5 relative group">
                    <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-700" />
                    <Brain className="w-5 h-5 text-indigo-400 relative" />
                    <p className="text-sm font-black tracking-[0.3em] uppercase text-slate-800 dark:text-white relative">MindSync</p>
                </div>
                <p className="text-[9px] font-bold uppercase tracking-[0.5em] text-slate-400 dark:text-slate-500 mt-1">Sync. Focus. Flow.</p>
                
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                    <span>MindSync © {new Date().getFullYear()}</span>
                    <span className="hidden sm:inline-block text-slate-300 dark:text-slate-800">|</span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-500">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-black tracking-wider">All Systems Operational</span>
                    </div>
                </div>
            </div>

            {/* Data Management Modal (Glass Focus) */}
            <AnimatePresence>
                {showDataModal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" 
                        onClick={() => setShowDataModal(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 250 }}
                            className="bg-slate-900 border border-white/10 w-full max-w-xs rounded-3xl shadow-2xl p-4 sm:p-5 flex flex-col max-h-[90vh] relative overflow-hidden" 
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[80px] pointer-events-none" />

                            {/* Scrollable Container inside Modal */}
                            <div className="overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4 pb-2">
                                <div className="text-center space-y-2 relative shrink-0 pt-2">
                                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/20 rotate-3 group-hover:rotate-0 transition-all duration-500 border border-white/10 backdrop-blur-xl">
                                        <DataLabIcon className="w-10 h-10" isLarge={true} />
                                    </div>
                                    <h3 className="text-xl font-black text-white tracking-tight">Data Lab</h3>
                                    <p className="text-xs text-slate-400 font-medium px-4">Maintain, back up, or restore your neural data snapshots</p>
                                </div>

                                <div className="grid grid-cols-1 gap-3 relative shrink-0">
                                    <button
                                        onClick={() => { handleExport(); setShowDataModal(false); }}
                                        className="flex items-center justify-between w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform duration-300">
                                                <Upload className="w-5 h-5" />
                                            </div>
                                            <div className="text-left font-bold">
                                                <div className="text-white text-sm">Export Snaps</div>
                                                <div className="text-[9px] text-slate-500 uppercase tracking-widest">JSON Report</div>
                                            </div>
                                        </div>
                                        <ArrowDown className="w-4 h-4 text-white group-hover:translate-y-1 transition-transform" />
                                    </button>

                                    <button
                                        onClick={() => { handleImport(); setShowDataModal(false); }}
                                        className="flex items-center justify-between w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                                                <Download className="w-5 h-5" />
                                            </div>
                                            <div className="text-left font-bold">
                                                <div className="text-white text-sm">Restore Data</div>
                                                <div className="text-[9px] text-slate-500 uppercase tracking-widest">Neural Sync</div>
                                            </div>
                                        </div>
                                        <ArrowUp className="w-4 h-4 text-white group-hover:-translate-y-1 transition-transform" />
                                    </button>

                                    <button
                                        onClick={async () => {
                                            if (confirm('Are you sure you want to completely erase all your data (tasks, history, memory, goals)? This action cannot be undone.')) {
                                                await clearAllData();
                                                setShowDataModal(false);
                                                alert('All data has been erased.');
                                            }
                                        }}
                                        className="flex items-center justify-between w-full p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform duration-300">
                                                <Trash2 className="w-5 h-5" />
                                            </div>
                                            <div className="text-left font-bold">
                                                <div className="text-red-400 text-sm">Erase All Data</div>
                                                <div className="text-[9px] text-red-500/70 uppercase tracking-widest">Wipe Neural Core</div>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 flex gap-3 items-center text-left shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                    <p className="text-[10px] font-bold text-amber-200/80 leading-snug">
                                        Neural Sync will <span className="text-amber-400 uppercase tracking-widest">overwrite</span> current state.
                                    </p>
                                </div>

                                <button
                                    onClick={() => setShowDataModal(false)}
                                    className="w-full py-3 shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                                >
                                    Return to Hub
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            </div>
        </div>
    );
}
