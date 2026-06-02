'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { X, Send, Bot, Sparkles, TrendingUp, MessageCircle, Trash2, User, PlusCircle, CheckCircle2, RotateCw, Brain, Cpu, Clock, Flag, Zap, Activity, ChevronDown } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { Task, DailySnapshot, Goal, TaskType } from '@/types';
import { parseNaturalDateTime, format12h } from '@/lib/datePatterns';
import { parseOfflineTask, generateSmartInsight } from '@/lib/smartLogic';
import { parseCoachResponse } from '@/lib/coachLogic';
import ModeSelector from '@/components/ModeSelector';

interface AICoachScreenProps {
    tasks: Task[];
    score: number;
    balance: string;
    history: DailySnapshot[];
    goals: Goal[];
    initialMode?: CoachMode;
    initialQuestion?: string;
    onClose?: () => void;
    onEditTask?: (task: Task) => void;
}

type CoachMode = 'advice' | 'chat' | 'summary' | 'predict' | 'evening_recap' | 'morning_brief' | 'night_reflection';

interface SuggestedAction {
    type: 'CREATE_TASK' | 'REMEMBER';
    title?: string;
    taskType?: TaskType;
    duration?: number;
    scheduledDate?: string;
    scheduledTime?: string;
    projectedScore?: number; // Predicted impact on Ego Score (+5, -3, etc.)
    fact?: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    actions?: SuggestedAction[];
    thought?: string; // Collapsible reasoning thoughts (o1/Claude 3.7 style)
    executedActions?: number[];
}

const modeButtons = [
    { mode: 'advice' as CoachMode, icon: Sparkles, label: 'Advice' },
    { mode: 'chat' as CoachMode, icon: MessageCircle, label: 'Chat' },
    { mode: 'summary' as CoachMode, icon: TrendingUp, label: 'Summary' },
    { mode: 'predict' as CoachMode, icon: Cpu, label: 'Predict plan' },
    { mode: 'evening_recap' as CoachMode, icon: Sparkles, label: 'Daily Recap' }
];

export default function AICoachScreen({
    tasks,
    score,
    balance,
    history,
    goals,
    initialMode = 'advice',
    initialQuestion,
    onClose,
    onEditTask
}: AICoachScreenProps) {
    const [mode, setMode] = useState<CoachMode>(initialMode);
    const [summaryInterval, setSummaryInterval] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    const displayMode = (mode === 'morning_brief' || mode === 'evening_recap' || mode === 'night_reflection') ? 'evening_recap' : mode;
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isChatHydrated, setIsChatHydrated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [quickAddTitle, setQuickAddTitle] = useState('');
    const [quickAddType, setQuickAddType] = useState<TaskType>('ADULT');
    const [quickAddDuration, setQuickAddDuration] = useState<number>(30);
    const [quickAddError, setQuickAddError] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const addTask = useStore((state) => state.addTask);
    const moveTask = useStore((state) => state.moveTask);
    const preferences = useStore((state) => state.preferences);
    const aiMemory = useStore((state) => state.aiMemory);
    const addMemory = useStore((state) => state.addMemory);
    const hasAutoTriggered = useRef(false);

    const now = new Date();
    const currentDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const missedTasks = tasks.filter(t => 
        t.scheduledDate === currentDateKey && 
        t.scheduledTime && 
        t.scheduledTime < currentTimeStr && 
        t.status !== 'DONE'
    );

    // Load saved messages on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('mindsync_coach_messages');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    const loaded = parsed.map((m: any) => ({
                        ...m,
                        timestamp: new Date(m.timestamp)
                    }));
                    setMessages(loaded);
                } catch (e) {
                    console.error('Failed to parse saved coach messages', e);
                }
            }
            setIsChatHydrated(true);
        }
    }, []);

    // Save messages to localStorage on change
    useEffect(() => {
        if (isChatHydrated && typeof window !== 'undefined') {
            localStorage.setItem('mindsync_coach_messages', JSON.stringify(messages));
        }
    }, [messages, isChatHydrated]);

    const handleInlineSubmit = () => {
        if (!quickAddTitle.trim()) {
            setQuickAddError('Title is required');
            return;
        }
        const now = new Date();
        const localDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const duration = isNaN(quickAddDuration) || quickAddDuration <= 0 ? 30 : quickAddDuration;
        addTask(quickAddTitle.trim(), quickAddType, localDateKey, undefined, duration);
        setQuickAddTitle('');
        setIsQuickAddOpen(false);
    };

    // Sync mode with initialMode
    useEffect(() => {
        if (initialMode) {
            if (initialMode === 'evening_recap') {
                const hr = new Date().getHours();
                let targetMode: CoachMode = 'evening_recap';
                if (hr >= 5 && hr < 12) {
                    targetMode = 'morning_brief';
                } else if (hr >= 21 || hr < 5) {
                    targetMode = 'night_reflection';
                }
                setMode(targetMode);
            } else {
                setMode(initialMode);
            }
        }
    }, [initialMode]);

    // Auto-trigger on mount or mode change from outside
    useEffect(() => {
        if (initialMode && initialMode !== 'advice' && !hasAutoTriggered.current) {
            if (initialMode === 'chat' && initialQuestion) {
                setQuestion(initialQuestion);
                handleAskCoach('chat', initialQuestion);
            } else if (initialMode === 'evening_recap') {
                const hr = new Date().getHours();
                let targetMode: CoachMode = 'evening_recap';
                if (hr >= 5 && hr < 12) {
                    targetMode = 'morning_brief';
                } else if (hr >= 21 || hr < 5) {
                    targetMode = 'night_reflection';
                }
                setMode(targetMode);
                handleAskCoach(targetMode);
            } else {
                handleAskCoach(initialMode);
            }
            hasAutoTriggered.current = true;
        }
    }, [initialMode, initialQuestion]);

    const handleSuggestAnother = (action: SuggestedAction) => {
        const prompt = `I'd like 3 distinct alternative suggestions for "${action.title}". Provide 3 different tasks of type ${action.taskType} that would fit my schedule for ${action.scheduledDate || 'today'}. Return them as separate Action Blocks.`;
        handleAskCoach('chat', prompt);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Simple Markdown Renderer for AI responses
    const renderMarkdown = (text: string): ReactNode => {
        const paragraphs = text.split(/\n\n+/);
        return paragraphs.map((paragraph, pIdx) => {
            const lines = paragraph.split('\n');
            const isBulletList = lines.every(line => line.trim() === '' || /^[-*•]\s/.test(line.trim()));
            const isNumberedList = lines.every(line => line.trim() === '' || /^\d+[.)]\s/.test(line.trim()));

            if (isBulletList) {
                const listItems = lines.filter(line => /^[-*•]\s/.test(line.trim()));
                return (
                    <ul key={pIdx} className="list-disc list-inside space-y-1.5 my-2 pl-2">
                        {listItems.map((item, idx) => (
                            <li key={idx} className="text-white/90 text-sm leading-relaxed">
                                {renderInlineMarkdown(item.replace(/^[-*•]\s+/, ''))}
                            </li>
                        ))}
                    </ul>
                );
            }

            if (isNumberedList) {
                const listItems = lines.filter(line => /^\d+[.)]\s/.test(line.trim()));
                return (
                    <ol key={pIdx} className="list-decimal list-inside space-y-1.5 my-2 pl-2">
                        {listItems.map((item, idx) => (
                            <li key={idx} className="text-white/90 text-sm leading-relaxed">
                                {renderInlineMarkdown(item.replace(/^\d+[.)]\s+/, ''))}
                            </li>
                        ))}
                    </ol>
                );
            }

            const hasLineBreaks = paragraph.includes('\n');
            if (hasLineBreaks) {
                return (
                    <div key={pIdx} className="mb-3 last:mb-0 space-y-1.5">
                        {lines.filter(l => l.trim()).map((line, idx) => (
                            <p key={idx} className="text-sm leading-relaxed">{renderInlineMarkdown(line)}</p>
                        ))}
                    </div>
                );
            }

            return (
                <p key={pIdx} className="mb-3 last:mb-0 text-sm leading-relaxed">
                    {renderInlineMarkdown(paragraph)}
                </p>
            );
        });
    };

    const renderInlineMarkdown = (text: string): ReactNode => {
        const parts: ReactNode[] = [];
        let lastIndex = 0;
        const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\`(.+?)\`)/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }
            if (match[1]) parts.push(<strong key={match.index} className="font-extrabold text-white">{match[2]}</strong>);
            else if (match[3]) parts.push(<em key={match.index} className="italic text-slate-100">{match[4]}</em>);
            else if (match[5]) parts.push(<code key={match.index} className="bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 text-xs font-mono">{match[6]}</code>);
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) parts.push(text.slice(lastIndex));
        return parts.length > 0 ? parts : text;
    };

    const parseResponse = parseCoachResponse;

    const handleExecuteAction = (action: SuggestedAction, messageId: string) => {
        if (action.type === 'CREATE_TASK') {
            const now = new Date();
            const localDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            addTask(
                action.title || 'Untitled',
                action.taskType || 'ADULT',
                action.scheduledDate || localDateKey,
                action.scheduledTime,
                action.duration
            );
        } else if (action.type === 'REMEMBER' && action.fact) {
            addMemory(action.fact);
        }
    };

    const handleAskCoach = async (selectedMode?: CoachMode, overrideQuestion?: string, overrideInterval?: 'daily' | 'weekly' | 'monthly') => {
        const activeMode = selectedMode || mode;
        const currentQuestion = overrideQuestion || question;

        if (activeMode === 'chat' && currentQuestion.trim()) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: currentQuestion, timestamp: new Date() }]);
            setQuestion('');
        } else if (activeMode === 'evening_recap' && !overrideQuestion) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: 'Please give me an Evening Recap of my day.', timestamp: new Date() }]);
        } else if (activeMode === 'morning_brief' && !overrideQuestion) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: 'Please give me a Morning Briefing for my day.', timestamp: new Date() }]);
        } else if (activeMode === 'night_reflection' && !overrideQuestion) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: 'Please give me a Night Reflection for my day.', timestamp: new Date() }]);
        }

        const aiMsgId = (Date.now() + 1).toString();

        // Add placeholder assistant message immediately for better UX
        if (activeMode === 'chat') {
            setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date() }]);
        }

        setIsLoading(true);
        setIsTyping(true);
        setError('');

        try {
            if (preferences.aiEnabled === false) {
                await runOfflineLogic(activeMode, currentQuestion, overrideInterval, aiMsgId);
                setIsLoading(false);
                setIsTyping(false);
                return;
            }

            const now = new Date();
            const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const localTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch('/api/coach', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    mode: activeMode,
                    localDate,
                    localTime,
                    tasks: tasks.map(t => ({ type: t.type, status: t.status, title: t.title, scheduledDate: t.scheduledDate, scheduledTime: t.scheduledTime, duration: t.duration })),
                    score,
                    balance,
                    question: activeMode === 'chat' ? currentQuestion : undefined,
                    conversationHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
                    history: history.map(h => ({ date: h.date, score: h.score, adultCompleted: h.adultCompleted, childCompleted: h.childCompleted })),
                    goals: goals.map(g => ({ title: g.title, targetDate: g.targetDate, startTime: g.startTime, completed: g.completed })),
                    preferences,
                    aiMemory,
                    summaryInterval: activeMode === 'summary' ? (overrideInterval || summaryInterval) : undefined,
                }),
            });

            if (!res.body) throw new Error('No stream body');
            
            // If it's not chat mode, we didn't add the placeholder yet
            if (activeMode !== 'chat') {
                setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date() }]);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
                
                const { cleanText, thought } = parseResponse(fullText);
                setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: cleanText, thought } : msg));
            }

            const { cleanText, actions, thought } = parseResponse(fullText);
            setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: cleanText, actions: actions.length > 0 ? actions : undefined, thought } : msg));
        } catch (err) {
            console.warn('AI Unavailable, switching to Offline Mode', err);
            runOfflineLogic(activeMode, currentQuestion, overrideInterval, aiMsgId);
        } finally {
            setIsLoading(false);
            setIsTyping(false);
        }
    };

    const runOfflineLogic = async (activeMode: CoachMode, input: string, overrideInterval?: 'daily' | 'weekly' | 'monthly', existingMsgId?: string) => {
        const aiMsgId = existingMsgId || (Date.now() + 1).toString();
        await new Promise(resolve => setTimeout(resolve, 600));

        if (!existingMsgId || activeMode !== 'chat') {
            setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date() }]);
        }

        let responseText = '';
        const actions: SuggestedAction[] = [];

        const completedTasks = tasks.filter(t => t.status === 'DONE');
        const adultCount = completedTasks.filter(t => t.type === 'ADULT').length;
        const childCount = completedTasks.filter(t => t.type === 'CHILD').length;
        const restCount = completedTasks.filter(t => t.type === 'REST').length;
        
        const insight = generateSmartInsight(balance as any, score, adultCount, childCount, restCount);

        if (activeMode === 'advice') {
           responseText = `**[OFFLINE MODE]**\n\n${insight}`;
        } else if (activeMode === 'chat') {
            const isSuggestAnother = input.startsWith("I'd like 3 distinct alternative suggestions for");
            
            if (isSuggestAnother) {
                responseText = `**[OFFLINE MODE]**\n\nI cannot generate dynamic alternatives while offline. Please try adding a task manually or reconnect to the cloud.`;
            } else {
                const parsed = parseOfflineTask(input);
                const isTaskRequest = parsed.title && parsed.title !== 'New Task';
                
                if (isTaskRequest) {
                    responseText = `I've prepared that task for you to schedule. Click 'Add to Timeline' below to commit it.`;
                    actions.push({
                        type: 'CREATE_TASK',
                        title: parsed.title!,
                        taskType: parsed.type || 'ADULT',
                        duration: parsed.duration || 30,
                        scheduledDate: parsed.scheduledDate,
                        scheduledTime: parsed.scheduledTime,
                        projectedScore: 5
                    });
                } else {
                    responseText = `**[OFFLINE MODE]**\n\nI am currently offline, but I can still help you schedule tasks or check your balance.\n\nType something like **"Break at 12pm for 1 hour"** to add a task.\n\n> ${insight}`;
                }
            }
        } else if (activeMode === 'summary') {
             const interval = overrideInterval || summaryInterval || 'weekly';
             const intervalCapitalized = interval.charAt(0).toUpperCase() + interval.slice(1);
             responseText = `**[OFFLINE MODE]**

### ${intervalCapitalized} Pattern Summary
Based on your local status, you currently have an Ego Score of **${score}/100** with a **${balance}** balance. Today, you completed **${completedTasks.filter(t => t.type === 'ADULT').length} Adult**, **${completedTasks.filter(t => t.type === 'CHILD').length} Child**, and **${completedTasks.filter(t => t.type === 'REST').length} Rest** tasks.

### Key MindSync Insight
${insight}

*Detailed tracking and historical charts are available when online.*`;
        } else if (activeMode === 'evening_recap') {
            responseText = `**[OFFLINE MODE]**\n\nIt looks like you completed ${tasks.filter(t => t.status === 'DONE').length} tasks today. Rest well!`;
        } else if (activeMode === 'morning_brief') {
            responseText = `**[OFFLINE MODE]**\n\nGood morning! Today you have ${tasks.filter(t => t.scheduledDate === todayStr).length} tasks scheduled. Set your intentions and let's make it a balanced, productive day!`;
        } else if (activeMode === 'night_reflection') {
            responseText = `**[OFFLINE MODE]**\n\nGood night! You completed ${tasks.filter(t => t.status === 'DONE').length} tasks today. Let go of the day, wind down, and rest deeply.`;
        }

        const simulatedThought = `Offline parser completed. Inputs received: Mode: "${activeMode}", Balance: "${balance}". Inferred scheduling requirements based on key text phrases. Injecting custom scheduler recommendation template to resolve timeline conflicts offline.`;

        setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: responseText, actions: actions.length > 0 ? actions : undefined, thought: simulatedThought } : msg));
    };

    const deleteMessage = (id: string) => setMessages(prev => prev.filter(msg => msg.id !== id));
    const clearChat = () => { setMessages([]); setError(''); };

    // Quick Action Prompt pill handlers
    const handleTriggerPrompt = (pillText: string) => {
        setQuestion(pillText);
        handleAskCoach('chat', pillText);
    };

    // Calculate dates and stats for the Right diagnostics HUD
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const todayTasks = tasks.filter(t => t.scheduledDate === todayStr || (t.status === 'DONE' && t.completedAt?.startsWith(todayStr)));
    const adultTasks = todayTasks.filter(t => t.type === 'ADULT');
    const childTasks = todayTasks.filter(t => t.type === 'CHILD');
    const restTasks = todayTasks.filter(t => t.type === 'REST');

    const completedAdult = adultTasks.filter(t => t.status === 'DONE').length;
    const completedChild = childTasks.filter(t => t.status === 'DONE').length;
    const completedRest = restTasks.filter(t => t.status === 'DONE').length;

    const totalAdult = adultTasks.length;
    const totalChild = childTasks.length;
    const totalRest = restTasks.length;

    const upcomingTasks = tasks
        .filter(t => t.scheduledDate === todayStr && t.status !== 'DONE')
        .sort((a, b) => (a.scheduledTime || '') > (b.scheduledTime || '') ? 1 : -1)
        .slice(0, 3);

    const activeGoals = goals.filter(g => !g.completed).slice(0, 2);

    return (
        <div className="h-full flex flex-col bg-[#0f172a]/65 backdrop-blur-2xl overflow-hidden text-white border border-white/5 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.45)] relative">
            {/* Ambient Background Aura bleed-through enhancement */}
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-pink-500/5 pointer-events-none z-0" />

            {/* Shared Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-slate-950/25 backdrop-blur-md shrink-0 z-10 relative gap-4">
                {/* Left Side: Brand and Status */}
                <div className="flex items-center gap-3.5 shrink-0">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-fuchsia-500 rounded-xl blur-md opacity-60 group-hover:opacity-100 transition-opacity animate-pulse" />
                        <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-500/20 border border-white/20 overflow-hidden">

                            <FlowerOfLifeIcon className="w-[33px] h-[33px] text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
                        </div>
                    </div>
                    <div className="flex flex-col justify-center gap-0.5">
                        <div className="flex items-center gap-2">
                            <h2 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 text-base sm:text-lg leading-none tracking-tight drop-shadow-sm">
                                {preferences.aiEnabled !== false ? 'AI Coach' : 'Local Coach'}
                            </h2>
                            <span className="relative flex h-2 w-2 mt-0.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${preferences.aiEnabled !== false ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${preferences.aiEnabled !== false ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,1)]'}`}></span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black mt-0.5">
                            <span className="text-slate-400">Balance</span>
                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                <span className="text-white font-black">{score}</span>
                                <span className="text-white/30">•</span>
                                <span className={balance === 'optimal' ? 'text-emerald-400 font-black' : 'text-amber-400 font-black'}>{balance}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Center: Integrated Low-Profile Mode Selector (Desktop Space Optimization) */}
                <ModeSelector 
                    modes={modeButtons}
                    currentMode={displayMode}
                    onModeChange={(newMode) => { 
                        if (newMode === 'evening_recap') {
                            const hr = new Date().getHours();
                            let targetMode: CoachMode = 'evening_recap';
                            if (hr >= 5 && hr < 12) {
                                targetMode = 'morning_brief';
                            } else if (hr >= 21 || hr < 5) {
                                targetMode = 'night_reflection';
                            }
                            setMode(targetMode);
                            handleAskCoach(targetMode);
                        } else {
                            setMode(newMode);
                            if (newMode !== 'chat') handleAskCoach(newMode);
                        }
                    }}
                    containerClassName="hidden md:flex bg-slate-950/50 p-1.5 rounded-2xl border border-white/10 relative overflow-x-auto scrollbar-none backdrop-blur-md max-w-2xl flex-1 gap-1"
                    buttonClassName="shrink-0 flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[10.5px] md:text-[11px] font-extrabold uppercase tracking-widest transition-all duration-300 relative z-10 whitespace-nowrap"
                    labelVisibilityClass="hidden xl:inline whitespace-nowrap"
                    shortLabelVisibilityClass="inline xl:hidden whitespace-nowrap"
                />

                {/* Right Side: Clear & Exit Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {messages.length > 0 && (
                        <button onClick={clearChat} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-red-400 transition-all active:scale-90" title="Clear Chat">
                            <Trash2 className="w-4.5 h-4.5" />
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-90 flex items-center justify-center" title="Exit Coach">
                        <X className="w-4.5 h-4.5" />
                    </button>
                </div>
            </div>

            {/* Split Screen Container */}
            <div className="flex-grow flex min-h-0 relative overflow-hidden">
                
                {/* LEFT COLUMN: Modern Conversational Thread */}
                <div className="flex-1 flex flex-col min-w-0 h-full relative">
                    
                    {/* Mobile-Only Mode Selector */}
                    <div className="px-5 py-3 shrink-0 bg-slate-950/10 backdrop-blur-sm border-b border-white/5 relative z-10 md:hidden">
                        <ModeSelector 
                            modes={modeButtons}
                            currentMode={displayMode}
                            onModeChange={(newMode) => { 
                                if (newMode === 'evening_recap') {
                                    const hr = new Date().getHours();
                                    let targetMode: CoachMode = 'evening_recap';
                                    if (hr >= 5 && hr < 12) {
                                        targetMode = 'morning_brief';
                                    } else if (hr >= 21 || hr < 5) {
                                        targetMode = 'night_reflection';
                                    }
                                    setMode(targetMode);
                                    handleAskCoach(targetMode);
                                } else {
                                    setMode(newMode);
                                    if (newMode !== 'chat') handleAskCoach(newMode);
                                }
                            }}
                            containerClassName="flex bg-slate-950/50 p-1.5 rounded-2xl border border-white/10 relative overflow-x-auto scrollbar-none backdrop-blur-md gap-1"
                            buttonClassName="shrink-0 flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl text-[11px] font-extrabold uppercase tracking-widest transition-all duration-300 relative z-10 whitespace-nowrap"
                            labelVisibilityClass="hidden sm:inline whitespace-nowrap"
                            shortLabelVisibilityClass="inline sm:hidden whitespace-nowrap"
                        />
                    </div>

                    {/* Sub-selector for Recaps (Morning, Evening, Night) */}
                    {(mode === 'morning_brief' || mode === 'evening_recap' || mode === 'night_reflection') && (
                        <div className="px-5 py-3 shrink-0 bg-slate-950/15 backdrop-blur-md border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-20">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recap Selection</span>
                            <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/10 relative overflow-hidden gap-1.5 w-full sm:w-auto">
                                {[
                                    { id: 'morning_brief' as CoachMode, label: 'Morning Brief', icon: '🌅', colorClass: 'text-amber-400' },
                                    { id: 'evening_recap' as CoachMode, label: 'Evening Recap', icon: '🌆', colorClass: 'text-orange-400' },
                                    { id: 'night_reflection' as CoachMode, label: 'Night Reflection', icon: '🌃', colorClass: 'text-indigo-400' }
                                ].map((sub) => {
                                    const isSubActive = mode === sub.id;
                                    return (
                                        <button
                                            key={sub.id}
                                            onClick={() => {
                                                setMode(sub.id);
                                                handleAskCoach(sub.id);
                                            }}
                                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 relative ${
                                                isSubActive ? 'text-white' : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            {isSubActive && (
                                                <div className="absolute inset-0 bg-white/10 rounded-lg border border-white/10 shadow-[0_2px_10px_rgba(255,255,255,0.05)]" />
                                            )}
                                            <span className={`${sub.colorClass} text-[13px]`}>{sub.icon}</span>
                                            <span className="hidden xs:inline">{sub.label}</span>
                                            <span className="inline xs:hidden">{sub.label.split(' ')[0]}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Sub-selector for Summary (Daily, Weekly, Monthly) */}
                    {mode === 'summary' && (
                        <div className="px-5 py-3 shrink-0 bg-slate-950/15 backdrop-blur-md border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-20">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Summary Scope</span>
                            <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/10 relative overflow-hidden gap-1.5 w-full sm:w-auto">
                                {[
                                    { id: 'daily' as const, label: 'Daily Summary', icon: '📅' },
                                    { id: 'weekly' as const, label: 'Weekly Summary', icon: '📊' },
                                    { id: 'monthly' as const, label: 'Monthly Summary', icon: '📈' }
                                ].map((sub) => {
                                    const isSubActive = summaryInterval === sub.id;
                                    return (
                                        <button
                                            key={sub.id}
                                            onClick={() => {
                                                setSummaryInterval(sub.id);
                                                handleAskCoach('summary', undefined, sub.id);
                                            }}
                                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 relative ${
                                                isSubActive ? 'text-white' : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            {isSubActive && (
                                                <div className="absolute inset-0 bg-white/10 rounded-lg border border-white/10 shadow-[0_2px_10px_rgba(255,255,255,0.05)]" />
                                            )}
                                            <span className="text-[13px]">{sub.icon}</span>
                                            <span className="hidden xs:inline">{sub.label}</span>
                                            <span className="inline xs:hidden">{sub.label.split(' ')[0]}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Messages Area */}
                    <div className="flex-1 px-5 py-6 overflow-y-auto space-y-6 custom-scrollbar scroll-smooth relative z-10">
                        {messages.length === 0 && !isLoading && !error && (
                            <div className="h-full flex flex-col items-center justify-center text-center px-8 relative overflow-hidden">
                                <div className="absolute w-[240px] h-[240px] bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none animate-pulse" />
                                <div className="absolute w-[180px] h-[180px] bg-purple-500/10 rounded-full blur-[40px] pointer-events-none animate-pulse delay-1000" />
                                
                                <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
                                    <div className="absolute inset-0 glow-wave-element" />
                                    <div className="absolute inset-2 glow-wave-element" style={{ animationDelay: '1.2s' }} />
                                    <div className="absolute inset-4 glow-wave-element" style={{ animationDelay: '2.4s' }} />
                                    
                                    <div className="cognitive-core w-20 h-20 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 border border-white/20">
                                        <FlowerOfLifeIcon className="w-10 h-10 text-white animate-[pulse_3s_ease-in-out_infinite]" />
                                    </div>
                                </div>
                                
                                <h3 className="text-xl font-black bg-gradient-to-r from-white via-slate-100 to-indigo-200 text-transparent bg-clip-text mb-2.5 tracking-tight">Syncing with your Neural Core</h3>
                                <p className="text-xs text-slate-400 max-w-[320px] leading-relaxed font-semibold">
                                    Your AI Mind Coach is standing by. Select a tab mode above or speak naturally to align your three-brain balance score.
                                </p>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div key={msg.id} className="space-y-4 animate-in slide-in-from-bottom-3 duration-300">
                                <div className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border border-white/10 transition-transform hover:scale-105 duration-300 ${msg.role === 'user' ? 'bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500' : 'bg-gradient-to-br from-purple-600 to-indigo-600'}`}>
                                        {msg.role === 'user' ? <FuturisticUserIcon className="w-[34px] h-[34px] text-white" /> : <FlowerOfLifeIcon className="w-[34px] h-[34px] text-white" />}
                                    </div>
                                    <div className={`relative max-w-[82%] border transition-all duration-300 group ${
                                        msg.role === 'user' 
                                            ? 'bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 border-indigo-500/30 text-white rounded-[24px] rounded-br-[4px] shadow-[0_8px_25px_-5px_rgba(99,102,241,0.45)] user-message-glow font-semibold px-5 py-3' 
                                            : 'bg-white/[0.04] dark:bg-white/[0.02] backdrop-blur-2xl border-white/10 text-slate-100 rounded-[28px] rounded-tl-[4px] shadow-[0_15px_50px_-15px_rgba(0,0,0,0.6)] assistant-message-glow hover:border-white/20 pl-6 pr-5 py-3'
                                    }`}>
                                        {/* Glowing Pulse Accent Strip for Assistant Bubble */}
                                        {msg.role === 'assistant' && (
                                            <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 rounded-r blur-[0.5px] opacity-70 animate-pulse" />
                                        )}

                                        {msg.content && msg.content.trim() && (
                                            <div className="text-[15px] leading-relaxed tracking-wide font-medium prose prose-invert prose-p:my-1.5 prose-li:my-0.5 max-w-none text-slate-100/95">{renderMarkdown(msg.content)}</div>
                                        )}
                                        
                                        {/* Collapsible Thoughts (o1/Claude 3.7 style reasoning panel) */}
                                        {msg.thought && (
                                            <div className="mt-3.5 flex flex-col items-center justify-center">
                                                <details className="group w-full max-w-md transition-all duration-500 ease-in-out">
                                                    <summary className="mx-auto w-fit flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 font-bold select-none text-[11px] uppercase tracking-wider cursor-pointer transition-all duration-300 shadow-[0_2px_10px_rgba(99,102,241,0.1)] hover:scale-105 active:scale-95 list-none [&::-webkit-details-marker]:hidden">
                                                        <div className="relative flex items-center justify-center">
                                                            <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-[3px] animate-pulse" />
                                                            <Brain className="w-3.5 h-3.5 text-indigo-400 relative z-10" />
                                                        </div>
                                                        <span className="leading-none mt-0.5">Cognitive Process</span>
                                                        <span className="text-[9px] text-slate-400 group-open:hidden uppercase font-black px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 ml-1">Expand</span>
                                                        <span className="text-[9px] text-indigo-300 hidden group-open:inline uppercase font-black px-1.5 py-0.5 rounded-full bg-indigo-500/25 border border-indigo-500/30 ml-1">Active</span>
                                                        <ChevronDown className="w-3 h-3 text-indigo-300/70 group-open:rotate-180 transition-transform duration-300 ml-0.5" />
                                                    </summary>
                                                    <div className="px-3.5 pb-3.5 pt-2.5 text-slate-300/85 leading-relaxed max-h-44 overflow-y-auto custom-scrollbar font-mono text-[11px] whitespace-pre-wrap bg-slate-950/45 rounded-2xl border border-white/5 backdrop-blur-md mt-2.5 italic animate-in slide-in-from-top-2 duration-300 shadow-inner">
                                                        <div className="flex gap-2 opacity-50 mb-1.5 justify-center">
                                                            <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping mt-1" />
                                                            <span className="text-[9px] uppercase tracking-tighter">Trace Initiated...</span>
                                                        </div>
                                                        {msg.thought}
                                                    </div>
                                                </details>
                                            </div>
                                        )}

                                        <button onClick={() => deleteMessage(msg.id)} className={`absolute -top-3 p-1.5 rounded-full bg-slate-950 border border-white/10 text-white/40 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md shadow-lg ${msg.role === 'user' ? '-left-3' : '-right-3'}`} title="Delete"><X className="w-3 h-3" /></button>
                                    </div>
                                </div>

                                {msg.actions && (
                                    <div className={`${msg.role === 'user' ? 'mr-13' : 'ml-13'} space-y-4`}>
                                        {msg.actions.map((action, idx) => {
                                            const isExecuted = msg.executedActions?.includes(idx);
                                            const design = action.taskType === 'CHILD' 
                                                ? { neon: 'suggestion-neon-pink', bg: 'bg-pink-500/[0.03]', border: 'border-pink-500/25 hover:border-pink-500/40', text: 'text-pink-400', emoji: '🩷' } 
                                                : action.taskType === 'REST'
                                                ? { neon: 'suggestion-neon-green', bg: 'bg-emerald-500/[0.03]', border: 'border-emerald-500/25 hover:border-emerald-500/40', text: 'text-emerald-400', emoji: '🟢' }
                                                : { neon: 'suggestion-neon-blue', bg: 'bg-indigo-500/[0.03]', border: 'border-indigo-500/25 hover:border-indigo-500/40', text: 'text-indigo-400', emoji: '🔵' };
                                            return (
                                                <div key={idx} className={`${design.bg} ${design.border} ${design.neon} border rounded-[24px] p-5 shadow-xl overflow-hidden backdrop-blur-md transition-all duration-300`}>
                                                    <div className="flex items-start justify-between gap-4 mb-4">
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-slate-200">
                                                                {action.type === 'CREATE_TASK' ? action.title : 'Mental Note'}
                                                            </div>
                                                            <div className="text-slate-400 mt-0.5 flex flex-wrap gap-2 items-center">
                                                                {action.type === 'CREATE_TASK' && (
                                                                    <>
                                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                            action.taskType === 'ADULT' ? 'bg-orange-500/20 text-orange-400' :
                                                                            action.taskType === 'CHILD' ? 'bg-sky-500/20 text-sky-400' :
                                                                            'bg-emerald-500/20 text-emerald-400'
                                                                        }`}>
                                                                            {action.taskType}
                                                                        </span>
                                                                        <span>{action.duration}m</span>
                                                                        {action.scheduledTime && <span>• {format12h(action.scheduledTime)}</span>}
                                                                    </>
                                                                )}
                                                                {action.type === 'REMEMBER' && (
                                                                    <span className="text-xs italic text-indigo-300">
                                                                        "{action.fact}"
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-3">
                                                        {!isExecuted ? (
                                                            <button
                                                                onClick={() => {
                                                                    handleExecuteAction(action, msg.id);
                                                                    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, executedActions: [...(m.executedActions || []), idx] } : m));
                                                                }}
                                                                className="flex-1 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:brightness-110 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 border border-white/10 active:scale-95"
                                                            >
                                                                {action.type === 'REMEMBER' ? <Brain className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                                                                {action.type === 'REMEMBER' ? 'Save Memory' : 'Add to Timeline'}
                                                            </button>
                                                        ) : (
                                                            <div className="flex-1 bg-emerald-500/20 text-emerald-400 py-3 rounded-2xl text-xs font-extrabold border border-emerald-500/25 cursor-default text-center tracking-widest uppercase">
                                                                {action.type === 'REMEMBER' ? 'Memory Saved' : 'Added to Timeline'}
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={() => handleSuggestAnother(action)}
                                                            className="flex-1 bg-white/5 hover:bg-white/10 text-white/70 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-white/10 active:scale-95"
                                                        >
                                                            <RotateCw className="w-3.5 h-3.5" />
                                                            Suggest Another
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex items-center gap-4 ml-12 animate-in fade-in duration-500">
                                <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-full animate-ping opacity-25" />
                                    <div className="absolute inset-0 border border-indigo-500/30 rounded-full animate-pulse" />
                                    <div className="w-3 h-3 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full animate-pulse shadow-lg shadow-indigo-500/50" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-bold text-slate-300 tracking-wide animate-pulse">Thinking...</span>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">Consulting Neural Core</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} className="h-4" />
                    </div>

                    {/* Suggestion Chips */}
                    {mode === 'chat' && (
                        <div className="px-5 pb-3 shrink-0 relative z-20 flex flex-wrap gap-2 bg-gradient-to-t from-slate-950/40 to-transparent">
                            {missedTasks.length > 0 && (
                                <button
                                    onClick={() => {
                                        const taskTitles = missedTasks.map(t => t.title).join(', ');
                                        const q = `I missed my scheduled tasks for today: ${taskTitles}. Please suggest a new time to shift them to, or let me know if I should move them to tomorrow.`;
                                        handleAskCoach('chat', q);
                                    }}
                                    className="px-4 py-2 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold hover:bg-orange-500/30 border border-orange-500/30 transition-all flex items-center gap-2 shadow-lg shadow-orange-500/10 hover:scale-105"
                                >
                                    <span className="material-icons-round text-[16px]">warning</span>
                                    ⚠️ Reschedule Missed Tasks
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    const q = `My energy is extremely low right now. Please review my upcoming tasks for today and suggest swapping one ADULT task for a REST or CHILD task.`;
                                    handleAskCoach('chat', q);
                                }}
                                className="px-4 py-2 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/30 border border-blue-500/30 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/10 hover:scale-105"
                            >
                                <span className="material-icons-round text-[16px]">battery_1_bar</span>
                                🔋 Low Energy: Need Swap
                            </button>
                        </div>
                    )}

                    {/* Floating Input command capsule */}
                    <div className="px-5 py-4 shrink-0 bg-gradient-to-t from-slate-950/20 to-transparent z-10 relative">
                        {/* Quick Prompts Capsules Row */}
                        <div className="flex gap-2 items-center overflow-x-auto custom-scrollbar pb-3 max-w-3xl mx-auto pl-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap mr-1">Prompts:</span>
                            <button onClick={() => handleTriggerPrompt("Analyze my today's balance")} className="text-[10px] font-bold px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.04] text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all active:scale-95 whitespace-nowrap">
                                🧠 Analyze Balance
                            </button>
                            <button onClick={() => handleTriggerPrompt("Suggest a child joy task")} className="text-[10px] font-bold px-3 py-1.5 rounded-full border border-pink-500/20 bg-pink-500/[0.04] text-pink-300 hover:bg-pink-500/10 hover:border-pink-500/40 transition-all active:scale-95 whitespace-nowrap">
                                🩷 Suggest Play Task
                            </button>
                            <button onClick={() => handleTriggerPrompt("Propose a perfect plan")} className="text-[10px] font-bold px-3 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/[0.04] text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all active:scale-95 whitespace-nowrap">
                                📅 Propose 24h Plan
                            </button>
                            <button onClick={() => handleTriggerPrompt("Need a recovery rest break")} className="text-[10px] font-bold px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all active:scale-95 whitespace-nowrap">
                                🟢 recovery break
                            </button>
                        </div>

                        {/* Modern Chat Input Shell */}
                        <div className="relative max-w-3xl mx-auto group">
                            {/* Animated glowing border effect */}
                            <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[28px] opacity-20 group-focus-within:opacity-50 transition-opacity duration-500 blur-[2px]"></div>
                            
                            <div className="relative flex items-end gap-3 bg-[#1e293b]/90 backdrop-blur-2xl rounded-[28px] border border-white/10 p-2 shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all">
                                <div className="flex-1 relative pl-4 pt-1.5 pb-1">
                                    <textarea
                                        rows={1}
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        onFocus={() => mode !== 'chat' && setMode('chat')}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (question.trim() && !isLoading) { handleAskCoach('chat'); setMode('chat'); } } }}
                                        placeholder="Ask MindSync..."
                                        className="w-full bg-transparent border-0 text-[15px] text-white placeholder-slate-400 focus:outline-none transition-all resize-none custom-scrollbar font-medium max-h-32 min-h-[44px] leading-relaxed"
                                    />
                                </div>
                                <button
                                    onClick={() => { handleAskCoach('chat'); setMode('chat'); }}
                                    disabled={!question.trim() || isLoading}
                                    className="h-[44px] w-[44px] rounded-[20px] bg-white hover:bg-slate-200 text-indigo-950 shadow-lg active:scale-95 disabled:bg-white/10 disabled:text-white/30 transition-all flex items-center justify-center shrink-0 border-none group"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-indigo-950/30 border-t-indigo-950 rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M5 12h14" />
                                            <path d="m12 5 7 7-7 7" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN: Interactive Diagnostics HUD (Desktop Space Optimization) */}
                <div className="hidden lg:flex flex-col w-[370px] h-full bg-slate-950/20 backdrop-blur-xl border-l border-white/5 p-6 overflow-y-auto custom-scrollbar gap-6 shrink-0 relative z-10">
                    
                    {/* Header Widget */}
                    <div className="flex items-center gap-2.5 border-b border-white/5 pb-4 shrink-0">
                        <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                        <div>
                            <h3 className="font-extrabold text-sm text-white tracking-tight uppercase leading-none">Mind Diagnostics</h3>
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1 block">Neural Core HUD v2.26</span>
                        </div>
                    </div>

                    {/* Concentric Circle HUD */}
                    <div className="flex flex-col items-center p-4 bg-slate-950/40 rounded-2xl border border-white/5 shadow-inner relative overflow-hidden group shrink-0 min-h-[255px] w-full" style={{ minHeight: '255px' }}>
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none opacity-40" />
                        
                        <div className="relative w-44 h-44 flex items-center justify-center mb-1 shrink-0" style={{ width: '176px', height: '176px', minWidth: '176px', minHeight: '176px' }}>
                            <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <defs>
                                    <linearGradient id="hudAdultGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#3b82f6" />
                                        <stop offset="100%" stopColor="#6366f1" />
                                    </linearGradient>
                                    <linearGradient id="hudChildGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#ec4899" />
                                        <stop offset="100%" stopColor="#f43f5e" />
                                    </linearGradient>
                                    <linearGradient id="hudRestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#10b981" />
                                        <stop offset="100%" stopColor="#14b8a6" />
                                    </linearGradient>
                                </defs>

                                {/* Grid circle support lines */}
                                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
                                <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
                                <circle cx="50" cy="50" r="24" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />

                                {/* Interactive concentric rings */}
                                <circle 
                                    cx="50" cy="50" r="40" 
                                    fill="none" 
                                    stroke="url(#hudAdultGrad)" 
                                    strokeWidth="5" 
                                    strokeLinecap="round"
                                    className="concentric-ring-circle"
                                    style={{
                                        strokeDasharray: '251.2',
                                        strokeDashoffset: 251.2 * (1 - (totalAdult > 0 ? completedAdult / totalAdult : 0.33)),
                                        filter: 'drop-shadow(0 0 5px rgba(99,102,241,0.45))'
                                    }}
                                />
                                <circle 
                                    cx="50" cy="50" r="32" 
                                    fill="none" 
                                    stroke="url(#hudChildGrad)" 
                                    strokeWidth="5" 
                                    strokeLinecap="round"
                                    className="concentric-ring-circle"
                                    style={{
                                        strokeDasharray: '201.1',
                                        strokeDashoffset: 201.1 * (1 - (totalChild > 0 ? completedChild / totalChild : 0.33)),
                                        filter: 'drop-shadow(0 0 5px rgba(236,72,153,0.45))'
                                    }}
                                />
                                <circle 
                                    cx="50" cy="50" r="24" 
                                    fill="none" 
                                    stroke="url(#hudRestGrad)" 
                                    strokeWidth="5" 
                                    strokeLinecap="round"
                                    className="concentric-ring-circle"
                                    style={{
                                        strokeDasharray: '150.8',
                                        strokeDashoffset: 150.8 * (1 - (totalRest > 0 ? completedRest / totalRest : 0.33)),
                                        filter: 'drop-shadow(0 0 5px rgba(16,185,129,0.45))'
                                    }}
                                />
                            </svg>
                            
                            <div className="flex flex-col items-center justify-center text-center leading-none z-10 select-none">
                                <span className="text-3xl font-black text-white tracking-tighter">{score}</span>
                                <span className="text-[8px] font-extrabold uppercase tracking-widest text-indigo-400 mt-1">{balance}</span>
                            </div>
                        </div>

                        {/* HUD Metrics legends */}
                        <div className="w-full grid grid-cols-3 gap-1.5 mt-2.5 pt-2.5 border-t border-white/5 text-center">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-400">Adult</span>
                                <span className="text-xs font-bold text-slate-100 mt-0.5">{completedAdult}/{totalAdult || 0}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-widest text-pink-400">Child</span>
                                <span className="text-xs font-bold text-slate-100 mt-0.5">{completedChild}/{totalChild || 0}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Rest</span>
                                <span className="text-xs font-bold text-slate-100 mt-0.5">{completedRest}/{totalRest || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Live Diagnostics Metrics Panel */}
                    <div className="space-y-3 shrink-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cognitive Status</div>
                        
                        {/* Adult/Focus status */}
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-slate-300">Adult Core (Focus)</span>
                                <span className="text-blue-400">{totalAdult > 0 ? Math.round((completedAdult / totalAdult) * 100) : 0}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalAdult > 0 ? (completedAdult / totalAdult) * 100 : 0}%` }} />
                            </div>
                            <p className="text-[9.5px] text-slate-400 font-semibold leading-relaxed">
                                {completedAdult >= 3 ? "✓ Productive limit secured. Avoid task overlap." : "⚡ Critical work remaining. High focus suggested."}
                            </p>
                        </div>

                        {/* Child/Id status */}
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-slate-300">Child Core (Joy)</span>
                                <span className="text-pink-400">{totalChild > 0 ? Math.round((completedChild / totalChild) * 100) : 0}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                                <div className="h-full bg-pink-500 rounded-full" style={{ width: `${totalChild > 0 ? (completedChild / totalChild) * 100 : 0}%` }} />
                            </div>
                            <p className="text-[9.5px] text-slate-400 font-semibold leading-relaxed">
                                {completedChild >= 2 ? "✓ Play balance active. Mood stable." : "⚡ Joy deficiency detected. Schedule fun activities."}
                            </p>
                        </div>

                        {/* Rest status */}
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-slate-300">Rest Core (Recovery)</span>
                                <span className="text-emerald-400">{totalRest > 0 ? Math.round((completedRest / totalRest) * 100) : 0}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalRest > 0 ? (completedRest / totalRest) * 100 : 0}%` }} />
                            </div>
                            <p className="text-[9.5px] text-slate-400 font-semibold leading-relaxed">
                                {completedRest >= 2 ? "✓ Sleep spacing secure. Brain fatigue low." : "⚡ Recovery spaces missing. Prevent cognitive burnout."}
                            </p>
                        </div>
                    </div>

                    {/* Timeline Projection Check */}
                    <div className="space-y-2.5 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Schedule Projections</div>
                            <button 
                                onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                                className="text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                                title="Toggle quick add event form"
                            >
                                <PlusCircle className="w-3.5 h-3.5" />
                                {isQuickAddOpen ? 'Close' : 'Quick Add'}
                            </button>
                        </div>

                        {/* Inline Quick Add Form */}
                        {isQuickAddOpen && (
                            <div className="p-3.5 bg-slate-900/60 rounded-xl border border-white/10 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                                <input 
                                    type="text"
                                    value={quickAddTitle}
                                    onChange={(e) => { setQuickAddTitle(e.target.value); setQuickAddError(''); }}
                                    placeholder="Event title (e.g. Coding)..."
                                    className="w-full bg-slate-950/60 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleInlineSubmit();
                                        }
                                    }}
                                />
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex bg-slate-950/40 p-0.5 rounded-lg border border-white/5">
                                        {(['ADULT', 'CHILD', 'REST'] as TaskType[]).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setQuickAddType(t)}
                                                className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${quickAddType === t ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                {t === 'ADULT' ? '🔵 Focus' : t === 'CHILD' ? '🩷 Joy' : '🟢 Rest'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-slate-950/40 border border-white/5 rounded-lg px-2 py-1">
                                        <input 
                                            type="number"
                                            value={quickAddDuration}
                                            onChange={(e) => setQuickAddDuration(Number(e.target.value))}
                                            className="w-8 bg-transparent border-none text-[10px] font-bold text-center text-white focus:outline-none"
                                            min={5}
                                        />
                                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest pr-1">Min</span>
                                    </div>
                                </div>
                                {quickAddError && <p className="text-[10px] text-red-400 font-semibold">{quickAddError}</p>}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleInlineSubmit}
                                        className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:brightness-110 text-white py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 border border-white/10 active:scale-95"
                                    >
                                        <PlusCircle className="w-3 h-3" />
                                        Add Event
                                    </button>
                                    <button
                                        onClick={() => { setIsQuickAddOpen(false); setQuickAddTitle(''); }}
                                        className="px-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {upcomingTasks.length === 0 ? (
                            <div className="p-3 bg-slate-900/40 rounded-xl border border-dashed border-white/5 text-center py-4">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400/80 mx-auto" />
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">No remaining tasks</p>
                                <p className="text-[9.5px] text-slate-500 font-semibold mt-0.5">Timeline aligned for today.</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {upcomingTasks.map((t, idx) => (
                                    <div key={idx} className="p-2.5 bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between gap-3 group/task duration-300 hover:bg-white/[0.03]">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {/* Interactive Complete Checkbox */}
                                            <button
                                                onClick={() => moveTask(t.id, 'DONE')}
                                                className={`group/check w-5.5 h-5.5 rounded-full border flex items-center justify-center transition-all shrink-0 cursor-pointer relative overflow-hidden
                                                    ${t.type === 'CHILD' ? 'border-pink-500/40 hover:border-pink-500 hover:bg-pink-500/20' : ''}
                                                    ${t.type === 'REST' ? 'border-emerald-500/40 hover:border-emerald-500 hover:bg-emerald-500/20' : ''}
                                                    ${t.type === 'ADULT' ? 'border-blue-500/40 hover:border-blue-500 hover:bg-blue-500/20' : ''}
                                                `}
                                                title="Mark as Completed"
                                            >
                                                {/* Core Colored Dot */}
                                                <div className={`w-2 h-2 rounded-full absolute transition-all duration-300 group-hover/check:opacity-0 group-hover/check:scale-50
                                                    ${t.type === 'CHILD' ? 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]' : ''}
                                                    ${t.type === 'REST' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : ''}
                                                    ${t.type === 'ADULT' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : ''}
                                                `} />
                                                
                                                {/* Checkmark icon shown on hover */}
                                                <CheckCircle2 className="w-3.5 h-3.5 opacity-0 scale-50 group-hover/check:opacity-100 group-hover/check:scale-100 transition-all duration-200 text-white" />
                                            </button>

                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-100 truncate leading-tight group-hover/task:text-white transition-colors">{t.title}</p>
                                                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none mt-1 block">
                                                    {t.scheduledTime ? format12h(t.scheduledTime) : 'unplanned'} • {t.duration}m
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="flex items-center gap-0.5 text-[10px] font-black text-emerald-400">
                                                <Zap className="w-3 h-3 text-emerald-400 shrink-0 animate-pulse" />
                                                <span>+5</span>
                                            </div>
                                            {onEditTask && (
                                                <button
                                                    onClick={() => onEditTask(t)}
                                                    className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer flex items-center justify-center border border-indigo-500/15"
                                                    title={t.scheduledTime ? "Edit Event" : "Add Time / Schedule Event"}
                                                >
                                                    <PlusCircle className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Goals Progress panel */}
                    {activeGoals.length > 0 && (
                        <div className="space-y-2.5 shrink-0">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Milestone Flags</div>
                            <div className="space-y-1.5">
                                {activeGoals.map((g, idx) => (
                                    <div key={idx} className="p-2.5 bg-[#d97706]/[0.02] border border-[#d97706]/15 rounded-xl flex items-center gap-2.5">
                                        <Flag className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-100 truncate leading-tight">{g.title}</p>
                                            <span className="text-[9px] text-amber-500 uppercase font-black tracking-widest mt-0.5 block leading-none">
                                                Due {g.targetDate ? new Date(g.targetDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Soon'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
}

// ==========================================
// CUSTOM BRAND & SYSTEM ICONS
// ==========================================

// Futuristic Seed of Life (Flower of Life) AI Icon
export function FlowerOfLifeIcon({ className = "w-5 h-5 text-white" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer dotted orbit */}
            <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" className="opacity-40 animate-[spin_60s_linear_infinite]" />
            {/* Outer ring */}
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1" className="opacity-60" />
            
            {/* Sacred Geometry: 7 Circles of Seed of Life */}
            {/* Center Circle */}
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.2" className="opacity-95" />
            {/* Overlapping Six Circles (Radius 4, Center at distance 4 from 12,12) */}
            <circle cx="16" cy="12" r="4" stroke="currentColor" strokeWidth="0.9" className="opacity-75" />
            <circle cx="14" cy="15.46" r="4" stroke="currentColor" strokeWidth="0.9" className="opacity-75" />
            <circle cx="10" cy="15.46" r="4" stroke="currentColor" strokeWidth="0.9" className="opacity-75" />
            <circle cx="8" cy="12" r="4" stroke="currentColor" strokeWidth="0.9" className="opacity-75" />
            <circle cx="10" cy="8.54" r="4" stroke="currentColor" strokeWidth="0.9" className="opacity-75" />
            <circle cx="14" cy="8.54" r="4" stroke="currentColor" strokeWidth="0.9" className="opacity-75" />
            
            {/* Stellar alignment nodes */}
            <circle cx="12" cy="12" r="1" fill="currentColor" className="animate-pulse" />
            <circle cx="12" cy="3" r="0.75" fill="currentColor" />
            <circle cx="12" cy="21" r="0.75" fill="currentColor" />
            <circle cx="4.2" cy="7.5" r="0.75" fill="currentColor" />
            <circle cx="19.8" cy="7.5" r="0.75" fill="currentColor" />
            <circle cx="4.2" cy="16.5" r="0.75" fill="currentColor" />
            <circle cx="19.8" cy="16.5" r="0.75" fill="currentColor" />
        </svg>
    );
}

// Futuristic Cybernetic User Icon
export function FuturisticUserIcon({ className = "w-5 h-5 text-white" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Cyber Helmet Visor shape */}
            <path d="M12 11.5C14.2091 11.5 16 9.70914 16 7.5C16 5.29086 14.2091 3.5 12 3.5C9.79086 3.5 8 5.29086 8 7.5C8 9.70914 9.79086 11.5 12 11.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Visor glowing horizontal stripe */}
            <path d="M9.5 7H14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="animate-pulse text-indigo-300" />
            {/* Neck link */}
            <path d="M12 11.5V14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            {/* Sleek tech-collar shoulders */}
            <path d="M5.5 19.5C5.5 16.5 8.5 14 12 14C15.5 14 18.5 16.5 18.5 19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Chest tech plate */}
            <path d="M9 17.5H15" stroke="currentColor" strokeWidth="1" className="opacity-80" />
            {/* Tech alignment corners/crosshairs surrounding */}
            <path d="M3 7V4.5H6.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" className="opacity-40" />
            <path d="M21 7V4.5H17.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" className="opacity-40" />
            <path d="M3 17V19.5H6.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" className="opacity-40" />
            <path d="M21 17V19.5H17.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" className="opacity-40" />
        </svg>
    );
}
