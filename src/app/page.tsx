'use client';

import { useState, useEffect, useSyncExternalStore, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { TaskType, Task } from '@/types';
import AddTaskPanel from '@/components/AddTaskPanel';
import ProgressChart from '@/components/ProgressChart';

import EditTaskModal from '@/components/EditTaskModal';
import GoalsPanel from '@/components/GoalsPanel';
import TimelineView from '@/components/TimelineView';
import BottomNav from '@/components/BottomNav';

import AICoachScreen from '@/components/AICoachScreen';
import SettingsTab from '@/components/SettingsTab';
import ScoreGauge from '@/components/ScoreGauge';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Plus, Target } from 'lucide-react';


function useHydration() {
  return useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  );
}

export default function Home() {
  const isHydrated = useHydration();
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creatingTaskSlot, setCreatingTaskSlot] = useState<{ date: string; time: string } | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'stats' | 'coach' | 'settings'>('today');
  const [activeCoachMode, setActiveCoachMode] = useState<'advice' | 'chat' | 'summary' | 'predict' | 'evening_recap'>('advice');
  const [initialCoachQuestion, setInitialCoachQuestion] = useState<string>('');
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isNavbarHidden, setIsNavbarHidden] = useState(false);
  const lastScrollTopStatsRef = useRef<number>(0);

  // ... (rest of the state stays the same, adding plan results in small changes to types)

  // Zustand store
  const {
    tasks,
    history,
    goals,
    isAuthenticated,
    authError,
    addTask,
    updateTask,
    moveTask,
    deleteTask,
    saveDailySnapshot,
    addGoal,
    editGoal,
    toggleGoal,
    deleteGoal,
    getDailyScore,
    getTasksByStatus,
    exportData,
    importData,
    fetchInitialData,
    checkAuth,
    _hasHydrated,
  } = useStore(useShallow((state) => ({
    tasks: state.tasks,
    history: state.history,
    goals: state.goals,
    isAuthenticated: state.isAuthenticated,
    authError: state.authError,
    addTask: state.addTask,
    updateTask: state.updateTask,
    moveTask: state.moveTask,
    deleteTask: state.deleteTask,
    saveDailySnapshot: state.saveDailySnapshot,
    addGoal: state.addGoal,
    editGoal: state.editGoal,
    toggleGoal: state.toggleGoal,
    deleteGoal: state.deleteGoal,
    getDailyScore: state.getDailyScore,
    getTasksByStatus: state.getTasksByStatus,
    exportData: state.exportData,
    importData: state.importData,
    fetchInitialData: state.fetchInitialData,
    checkAuth: state.checkAuth,
    _hasHydrated: state._hasHydrated,
  })));

  // Hydration / Data Fetching
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('mindsync_test_mode') === 'true') {
        return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, !!session);
        if (session) {
          // User logged in - fetch their data
          fetchInitialData();
        } else {
          // User logged out - clear data
          useStore.getState().resetStore();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Dropdown click-away listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsHeaderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close Add Task panel and show navbar when switching tabs
  useEffect(() => {
    setIsAddTaskOpen(false);
    setIsNavbarHidden(false);
  }, [activeTab]);

  const { score, balance } = getDailyScore();

  // Compute daily ratios for background aura and concentric rings
  const todayStr = (() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

  const todayTasks = tasks.filter((t) => {
    const isCompletedToday = t.status === 'DONE' && t.completedAt?.startsWith(todayStr);
    const isScheduledToday = t.scheduledDate === todayStr;
    return isCompletedToday || isScheduledToday;
  });

  const adultCount = todayTasks.filter((t) => t.type === 'ADULT').length;
  const childCount = todayTasks.filter((t) => t.type === 'CHILD').length;
  const restCount = todayTasks.filter((t) => t.type === 'REST').length;
  const totalCount = adultCount + childCount + restCount;

  const adultRatio = totalCount > 0 ? adultCount / totalCount : 0.33;
  const childRatio = totalCount > 0 ? childCount / totalCount : 0.33;
  const restRatio = totalCount > 0 ? restCount / totalCount : 0.33;

  const handleAddNewTask = (title: string, type: TaskType, date?: string, time?: string, duration?: number) => {
    addTask(title, type, date, time, duration);
    // Optional: setIsAddTaskOpen(false); if we want auto-close
  };

  const handleExport = () => {
    const data = exportData();
    // Use data URI instead of blob URL for better filename reliability
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = 'brain-balance-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setIsHeaderDropdownOpen(false);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          const success = importData(result);
          if (success) {
            alert('Data imported successfully!');
          } else {
            alert('Failed to import data. Invalid format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
    setIsHeaderDropdownOpen(false);
  };

  if (!isHydrated || !_hasHydrated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-slate-400 flex items-center gap-2">
          <Brain className="w-5 h-5 animate-pulse text-indigo-400" />
          Loading...
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text mb-2">
              MindSync
            </h1>
            <p className="text-slate-400 mb-8">Sync your mind. Find your flow.</p>
          </div>

          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
            <h2 className="text-xl font-semibold text-white mb-2">Sign in to continue</h2>
            <p className="text-slate-400 text-sm">
              Your tasks, goals, and progress are securely synced to your account.
            </p>
            <Link
              href="/login"
              className="block w-full text-center px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-semibold rounded-xl hover:brightness-110 transition-all shadow-lg shadow-indigo-500/40"
            >
              Sign In / Sign Up
            </Link>
            {authError && (
              <p className="text-red-400 text-sm mt-2">{authError}</p>
            )}
          </div>

          <p className="text-center text-slate-500 text-xs">
            Don't have an account? Signing up will create one automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f172a] transition-colors duration-200 relative overflow-hidden">
      {/* Dynamic Mind Aura Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 hidden dark:block">
        {/* Adult Orb */}
        <div 
          className="aura-orb animate-aura-1 bg-gradient-to-br from-blue-600/30 to-indigo-800/30"
          style={{
            width: `${350 + adultRatio * 300}px`,
            height: `${350 + adultRatio * 300}px`,
            top: '5%',
            left: '10%',
            opacity: 0.15 + adultRatio * 0.4,
          }}
        />
        {/* Child Orb */}
        <div 
          className="aura-orb animate-aura-2 bg-gradient-to-br from-pink-500/25 to-rose-600/25"
          style={{
            width: `${350 + childRatio * 300}px`,
            height: `${350 + childRatio * 300}px`,
            bottom: '10%',
            right: '10%',
            opacity: 0.15 + childRatio * 0.4,
          }}
        />
        {/* Rest Orb */}
        <div 
          className="aura-orb animate-aura-3 bg-gradient-to-br from-emerald-500/25 to-teal-600/25"
          style={{
            width: `${320 + restRatio * 280}px`,
            height: `${320 + restRatio * 280}px`,
            top: '35%',
            right: '30%',
            opacity: 0.15 + restRatio * 0.4,
          }}
        />
      </div>

      {/* Header - Show on Today, Stats, and Settings tabs (unless Goals are open) */}
      {activeTab !== 'coach' && (
        <header className={`fixed top-0 left-0 right-0 z-50 border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-[#0f172a]/95 backdrop-blur-xl px-4 py-3 sm:px-6 sm:py-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-lg shadow-black/5 dark:shadow-[0_4px_30px_-10px_rgba(0,0,0,0.4)] ${
          isNavbarHidden || showGoals ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent"></div>
          <div className="max-w-[1400px] mx-auto flex items-center justify-between relative z-10">
            <div
              onClick={() => setActiveTab('today')}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 overflow-hidden group-hover:shadow-indigo-500/50 transition-shadow">

                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white transform group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
                </svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-base sm:text-lg lg:text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 leading-tight drop-shadow-sm">MindSync</h1>
                <p className="text-[8px] sm:text-[9px] font-bold text-slate-500 dark:text-slate-400/80 uppercase tracking-widest leading-none hidden lg:block mt-0.5">Sync. Focus. Flow.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 md:gap-5">
              {/* SVG Concentric Score Gauge */}
              <ScoreGauge
                score={score}
                balance={balance}
                adultRatio={adultRatio}
                childRatio={childRatio}
                restRatio={restRatio}
              />

              {/* Goals Toggle (Moved to Header) */}
              <button
                onClick={() => setShowGoals(!showGoals)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-medium transition-all duration-300 border group ${showGoals
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'bg-slate-100/50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                  }`}
                title={showGoals ? "Hide Goals" : "Show Goals"}
              >
                <Target className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${showGoals ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white'}`} />
                <span className="hidden lg:inline text-xs sm:text-sm font-semibold tracking-wide">{showGoals ? 'Hide' : 'Goals'}</span>
              </button>

              {/* New Task Button */}
              <button
                onClick={() => setIsAddTaskOpen(!isAddTaskOpen)}
                className={`hidden sm:flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-5 sm:py-2 rounded-full font-bold transition-all duration-300 shadow-xl active:scale-95 border ${isAddTaskOpen
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-300'
                  : 'bg-gradient-to-b from-indigo-500 to-indigo-600 border-indigo-400/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_14px_rgba(99,102,241,0.4)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_20px_rgba(99,102,241,0.5)] hover:-translate-y-0.5 text-white'
                  }`}
              >
                <Plus className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${isAddTaskOpen ? 'rotate-45' : ''}`} />
                <span className="hidden sm:inline whitespace-nowrap text-xs sm:text-sm tracking-wide">New Task</span>
              </button>


            </div>
          </div>
        </header>
      )}

      <main className={`mx-auto flex flex-col overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        activeTab === 'coach' 
          ? 'w-full max-w-[1600px] h-[100dvh] p-0 md:p-4 lg:p-6' 
          : `w-full max-w-md md:max-w-4xl lg:max-w-6xl xl:max-w-[1400px] h-[100dvh] px-4 pb-4 space-y-4 ${
              isNavbarHidden ? 'pt-4 sm:pt-6' : 'pt-20 sm:pt-24'
            }`
      }`}>
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'today' && (
              <motion.div
                key="today"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="h-full flex flex-col overflow-hidden pb-4"
              >
                <div className="flex-1 min-h-0 mt-4">
                  <TimelineView
                    tasks={tasks}
                    onMoveTask={moveTask}
                    onDeleteTask={deleteTask}
                    onUpdateTask={updateTask}
                    onAddTask={addTask}
                    onEditTask={setEditingTask}
                    onRequestCreateTask={(date, time) => setCreatingTaskSlot({ date, time })}
                    onScrollDirectionChange={setIsNavbarHidden}
                  />
                </div>
              </motion.div>
            )}

            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                onScroll={(e) => {
                  const scrollTop = e.currentTarget.scrollTop;
                  const maxScroll = e.currentTarget.scrollHeight - e.currentTarget.clientHeight;
                  
                  // Guard: If the previous scroll position is greater than the current maxScroll,
                  // it means the container resized and clamped the scroll position downward.
                  // This is an automatic layout adjustment, NOT a user scroll action.
                  if (lastScrollTopStatsRef.current > maxScroll) {
                    lastScrollTopStatsRef.current = scrollTop;
                    return;
                  }

                  if (Math.abs(scrollTop - lastScrollTopStatsRef.current) < 10) return;
                  if (scrollTop > lastScrollTopStatsRef.current && scrollTop > 60) {
                    setIsNavbarHidden(true);
                  } else if (scrollTop < lastScrollTopStatsRef.current) {
                    if (scrollTop < maxScroll - 10) {
                      setIsNavbarHidden(false);
                    }
                  }
                  lastScrollTopStatsRef.current = scrollTop;
                }}
                className="h-full overflow-y-auto px-4 sm:px-6 custom-scrollbar scroll-smooth"
              >
                <div className="max-w-3xl mx-auto w-full pb-20 sm:pb-24 pt-2">
                  <ProgressChart history={history} />
                </div>
              </motion.div>
            )}

            {activeTab === 'coach' && (
              <motion.div
                key="coach"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="h-full"
              >
                <AICoachScreen
                  tasks={tasks}
                  score={score}
                  balance={balance}
                  history={history}
                  goals={goals}
                  initialMode={activeTab === 'coach' ? activeCoachMode : 'advice'}
                  initialQuestion={initialCoachQuestion}
                  onClose={() => { setActiveTab('today'); setInitialCoachQuestion(''); }}
                  onEditTask={setEditingTask}
                />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="h-full"
              >
                <SettingsTab
                  handleImport={handleImport}
                  handleExport={handleExport}
                  onScrollDirectionChange={setIsNavbarHidden}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <AddTaskPanel
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAdd={handleAddNewTask}
      />

      {/* Bottom Floating Action Button (FAB) */}
      {activeTab !== 'coach' && (
        <button
          onClick={() => setIsAddTaskOpen(true)}
          className={`fixed right-6 sm:right-10 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xl shadow-indigo-500/40 hover:brightness-110 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
            isNavbarHidden 
              ? 'translate-y-28 opacity-0 scale-90 pointer-events-none' 
              : 'translate-y-0 bottom-[76px] sm:bottom-[88px] opacity-100 scale-100'
          }`}
          title="Create New Task"
        >
          <Plus className="w-7 h-7 drop-shadow-sm" />
        </button>
      )}

      {/* Bottom Navigation */}
      {activeTab !== 'coach' && (
        <BottomNav
          currentTab={activeTab}
          onTabChange={(tab) => {
            if (tab === 'coach') {
              setActiveCoachMode('advice');
            }
            setActiveTab(tab);
          }}
          isHidden={isNavbarHidden}
        />
      )}



      <EditTaskModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        onSave={updateTask}
        onDelete={deleteTask}
      />

      <EditTaskModal
        isOpen={!!creatingTaskSlot}
        onClose={() => setCreatingTaskSlot(null)}
        task={null}
        initialDate={creatingTaskSlot?.date}
        initialTime={creatingTaskSlot?.time}
        onSave={() => {}} // Not used in create mode
        onCreate={(title, type, date, time, duration) => {
          handleAddNewTask(title, type, date, time, duration);
          setCreatingTaskSlot(null);
        }}
        onDelete={() => {}} // Not used in create mode
      />

      <AnimatePresence>
        {showGoals && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100]" 
              onClick={() => setShowGoals(false)} 
            />
            <GoalsPanel
              goals={goals}
              onAddGoal={addGoal}
              onEditGoal={editGoal}
              onToggleGoal={toggleGoal}
              onDeleteGoal={deleteGoal}
              onBreakdown={(goal) => {
                setShowGoals(false);
                setActiveCoachMode('chat');
                setInitialCoachQuestion(`Please break down my goal '${goal.title}' into 3-4 smaller, manageable tasks spread across the next few days. Please use the ACTION: CREATE_TASK format for each.`);
                setActiveTab('coach');
              }}
              onClose={() => setShowGoals(false)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
