import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Task, Goal, DailySnapshot, TaskType, TaskStatus, UserPreferences, AIMemory, LearnedPattern } from '@/types';

const getPreferencesFromEnv = (key: string, defaults: string[]): string[] => {
    try {
        const envValue = process.env[key];
        return envValue ? JSON.parse(envValue) : defaults;
    } catch (e) {
        console.warn(`Failed to parse preference from env: ${key}`, e);
        return defaults;
    }
};

export interface StoreState {
    // Auth State
    isAuthenticated: boolean;
    authError: string | null;

    // Network State
    isOnline: boolean;
    setIsOnline: (status: boolean) => void;

    // Tasks
    tasks: Task[];
    addTask: (title: string, type: TaskType, date?: string, time?: string, duration?: number) => void;
    moveTask: (taskId: string, newStatus: TaskStatus) => void;
    deleteTask: (taskId: string) => void;
    updateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'scheduledDate' | 'scheduledTime' | 'duration'>>) => void;
    clearCompletedTasks: () => void;

    // History
    history: DailySnapshot[];
    saveDailySnapshot: () => void;

    // Goals
    goals: Goal[];
    addGoal: (title: string, targetDate: string, startTime?: string) => void;
    editGoal: (goalId: string, title: string, targetDate: string, startTime?: string) => void;
    toggleGoal: (goalId: string) => void;
    deleteGoal: (goalId: string) => void;

    // AI Memory & Patterns
    aiMemory: AIMemory[];
    addMemory: (fact: string) => void;
    learnedPatterns: LearnedPattern[];
    addLearnedPattern: (pattern: string, confidence?: number) => void;

    // Preferences
    preferences: UserPreferences;
    updatePreferences: (prefs: Partial<UserPreferences>) => void;

    // Calculated
    getDailyScore: () => { score: number; balance: 'optimal' | 'anxiety' | 'depression' | 'neutral' };
    getTasksByStatus: (status: TaskStatus) => Task[];

    // Export/Import
    exportData: () => string;
    importData: (jsonData: string) => boolean;

    // Hydration / Sync
    _hasHydrated: boolean;
    isFetchingInitialData: boolean;
    fetchInitialData: () => Promise<void>;
    checkAuth: () => Promise<void>;
    resetStore: () => void;
    clearAllData: () => Promise<void>;
}

// ============ HELPER FUNCTIONS ============
const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const getTodayString = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Sorting Helpers
const sortTasks = (tasks: Task[]): Task[] => {
    return [...tasks].sort((a, b) => {
        // 1. Completion Status (DONE at the bottom)
        if (a.status === 'DONE' && b.status !== 'DONE') return 1;
        if (a.status !== 'DONE' && b.status === 'DONE') return -1;

        // 2. Overdue Tasks at the top
        const today = getTodayString();
        const aOverdue = a.scheduledDate && a.scheduledDate < today && a.status !== 'DONE';
        const bOverdue = b.scheduledDate && b.scheduledDate < today && b.status !== 'DONE';
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        // 3. Sort by Date
        const dateA = a.scheduledDate || '9999-99-99';
        const dateB = b.scheduledDate || '9999-99-99';
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        // 4. Sort by Time (Treat undefined as last for the day)
        const timeA = a.scheduledTime || '23:59:59';
        const timeB = b.scheduledTime || '23:59:59';
        if (timeA !== timeB) return timeA.localeCompare(timeB);

        // 5. Sort by Type Priority (ADULT > CHILD > REST)
        const typePriority = { ADULT: 1, CHILD: 2, REST: 3 };
        const priorityA = typePriority[a.type] || 99;
        const priorityB = typePriority[b.type] || 99;
        if (priorityA !== priorityB) return priorityA - priorityB;

        // 6. Sort by Creation (Stable)
        return a.createdAt.localeCompare(b.createdAt);
    });
};

const sortGoals = (goals: Goal[]): Goal[] => {
    return [...goals].sort((a, b) => {
        // 1. Completion Status (Completed at the bottom)
        if (a.completed !== b.completed) return a.completed ? 1 : -1;

        // 2. Overdue Goals at the top
        const today = getTodayString();
        const aOverdue = a.targetDate && a.targetDate < today && !a.completed;
        const bOverdue = b.targetDate && b.targetDate < today && !b.completed;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        // 3. Target Date (Urgency)
        const dateA = a.targetDate || '9999-99-99';
        const dateB = b.targetDate || '9999-99-99';
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        // 4. Created At
        return a.createdAt.localeCompare(b.createdAt);
    });
};

const sortHistory = (history: DailySnapshot[]): DailySnapshot[] => {
    return [...history].sort((a, b) => b.date.localeCompare(a.date)); // Newest first
};

let saveSnapshotTimeout: NodeJS.Timeout | null = null;

// ============ STORE ============
export const useStore = create<StoreState>()(
    persist(
        (set, get) => ({
            // Initial state
            isAuthenticated: false,
            authError: null,
            isOnline: true,
            tasks: [],
            history: [],
            goals: [],
            aiMemory: [],
            learnedPatterns: [],
            _hasHydrated: false,
            isFetchingInitialData: false,
            preferences: {
                hobbies: getPreferencesFromEnv('NEXT_PUBLIC_USER_HOBBIES', ['Reading', 'Hiking', 'Gaming']),
                interests: getPreferencesFromEnv('NEXT_PUBLIC_USER_INTERESTS', ['Technology', 'Art', 'Music']),
                passions: getPreferencesFromEnv('NEXT_PUBLIC_USER_PASSIONS', ['Learning', 'Creativity']),
                work: getPreferencesFromEnv('NEXT_PUBLIC_USER_WORK', ['Software Dev', 'Management']),
                aiEnabled: true,
                autoArrangeTasks: false,
                forceOfflineMode: false,
            },

    setIsOnline: (status: boolean) => set({ isOnline: status }),

    checkAuth: async () => {
        if (typeof window !== 'undefined' && localStorage.getItem('mindsync_test_mode') === 'true') {
            set({ isAuthenticated: true, authError: null });
            return;
        }
        try {
            const { data: { user } } = await supabase.auth.getUser();
            set({ isAuthenticated: !!user, authError: null });
        } catch (error) {
            console.error('Auth check failed:', error);
            set({ isAuthenticated: false, authError: 'Authentication check failed' });
        }
    },

    fetchInitialData: async () => {
        if (get().isFetchingInitialData) return;
        set({ isFetchingInitialData: true });
        
        if (typeof window !== 'undefined' && localStorage.getItem('mindsync_test_mode') === 'true') {
            set({ isAuthenticated: true, _hasHydrated: true, isFetchingInitialData: false });
            return;
        }

        try {
            // Check authentication first
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                set({
                    isAuthenticated: false,
                    authError: 'Please log in to access your data',
                    _hasHydrated: true,
                    isFetchingInitialData: false,
                    tasks: [],
                    goals: [],
                    history: [],
                    aiMemory: []
                });
                return;
            }

            set({ isAuthenticated: true, authError: null });

            // Fetch all data in parallel
            const [tasks, goals, profile, history, aiMemory] = await Promise.all([
                api.fetchTasks(),
                api.fetchGoals(),
                api.fetchProfile(),
                api.fetchHistory(),
                api.fetchMemories()
            ]);

            const newPrefs = { ...get().preferences };
            if (profile) {
                if (profile.hobbies?.length) newPrefs.hobbies = profile.hobbies;
                if (profile.interests?.length) newPrefs.interests = profile.interests;
                if (profile.passions?.length) newPrefs.passions = profile.passions;
                if (profile.work?.length) newPrefs.work = profile.work;
                if (profile.sleep_start_time) newPrefs.sleepStartTime = profile.sleep_start_time;
                if (profile.sleep_end_time) newPrefs.sleepEndTime = profile.sleep_end_time;
            }

            set({
                tasks: sortTasks(tasks),
                goals: sortGoals(goals),
                history: sortHistory(history),
                aiMemory: aiMemory || [],
                preferences: newPrefs,
                _hasHydrated: true,
                isFetchingInitialData: false
            });
        } catch (error) {
            console.error('Failed to fetch initial data:', error);
            set({ _hasHydrated: true, isFetchingInitialData: false });
        }
    },

    resetStore: () => {
        set({
            isAuthenticated: false,
            authError: null,
            tasks: [],
            history: [],
            goals: [],
            aiMemory: [],
            _hasHydrated: true // Keep true to avoid hydration mismatch
        });
    },

    clearAllData: async () => {
        set({
            tasks: [],
            history: [],
            goals: [],
            aiMemory: []
        });
        if (get().isAuthenticated) {
            await api.deleteAllData();
        }
    },

    // Task actions
    addTask: (title: string, type: TaskType, date?: string, time?: string, duration?: number) => {
        const initialStatus: TaskStatus = 'TODO';
        const newTask: Task = {
            id: generateId(),
            title,
            type,
            status: initialStatus,
            scheduledDate: date || getTodayString(),
            scheduledTime: time,
            duration,
            createdAt: new Date().toISOString(),
        };

        // Optimistic Update
        set((state) => ({ tasks: sortTasks([...state.tasks, newTask]) }));
        get().saveDailySnapshot();

        // Sync
        api.createTask(newTask).catch(console.error);
    },

    moveTask: (taskId: string, newStatus: TaskStatus) => {
        const completedAt = newStatus === 'DONE' ? new Date().toISOString() : undefined;

        // Optimistic
        set((state) => ({
            tasks: sortTasks(state.tasks.map((task) =>
                task.id === taskId
                    ? {
                        ...task,
                        status: newStatus,
                        completedAt: newStatus === 'DONE' ? completedAt : task.completedAt,
                    }
                    : task
            )),
        }));
        get().saveDailySnapshot();

        // Sync
        api.updateTask(taskId, { status: newStatus, completedAt }).catch(console.error);
    },

    deleteTask: (taskId: string) => {
        set((state) => ({
            tasks: state.tasks.filter((task) => task.id !== taskId),
        }));
        get().saveDailySnapshot();
        api.deleteTask(taskId).catch(console.error);
    },

    updateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'scheduledDate' | 'scheduledTime' | 'duration'>>) => {
        set((state) => ({
            tasks: sortTasks(state.tasks.map((task) =>
                task.id === taskId ? { ...task, ...updates } : task
            )),
        }));
        get().saveDailySnapshot();
        api.updateTask(taskId, updates).catch(console.error);
    },

    clearCompletedTasks: () => {
        const state = get();
        const doneTasks = state.tasks.filter(t => t.status === 'DONE');
        doneTasks.forEach(task => api.deleteTask(task.id).catch(console.error));

        set((state) => ({
            tasks: sortTasks(state.tasks.filter((task) => task.status !== 'DONE')),
        }));
        get().saveDailySnapshot();
    },

    // History actions
    saveDailySnapshot: () => {
        if (saveSnapshotTimeout) clearTimeout(saveSnapshotTimeout);
        
        const flushSnapshot = () => {
            const state = get();
            const today = getTodayString();
            const { score } = state.getDailyScore();

            const completedTasks = state.tasks.filter((t) => t.status === 'DONE');
            const adultCompleted = completedTasks.filter((t) => t.type === 'ADULT').length;
            const childCompleted = completedTasks.filter((t) => t.type === 'CHILD').length;
            const restCompleted = completedTasks.filter((t) => t.type === 'REST').length;

            const snapshot: DailySnapshot = {
                date: today,
                tasks: [...state.tasks],
                score,
                adultCompleted,
                childCompleted,
                restCompleted,
            };

            set((currentState) => {
                const existingIndex = currentState.history.findIndex((h) => h.date === today);
                if (existingIndex >= 0) {
                    const newHistory = [...currentState.history];
                    newHistory[existingIndex] = snapshot;
                    return { history: sortHistory(newHistory) };
                } else {
                    return { history: sortHistory([...currentState.history, snapshot]) };
                }
            });

            api.saveSnapshot(snapshot).catch(console.error);
        };

        // Attach a beforeunload listener once to ensure flush happens if the user leaves before timeout
        if (typeof window !== 'undefined' && !(window as any)._hasBeforeUnloadListener) {
            window.addEventListener('beforeunload', () => {
                if (saveSnapshotTimeout) {
                    clearTimeout(saveSnapshotTimeout);
                    flushSnapshot();
                }
            });
            (window as any)._hasBeforeUnloadListener = true;
        }

        saveSnapshotTimeout = setTimeout(() => {
            flushSnapshot();
            saveSnapshotTimeout = null;
        }, 1500); // Debounce to prevent over-saving during rapid changes
    },

    // Goal actions
    addGoal: (title: string, targetDate: string, startTime?: string) => {
        const newGoal: Goal = {
            id: generateId(),
            title,
            targetDate,
            startTime,
            completed: false,
            createdAt: new Date().toISOString(),
        };
        set((state) => ({ goals: sortGoals([...state.goals, newGoal]) }));
        api.createGoal(newGoal).catch(console.error);
    },

    editGoal: (goalId: string, title: string, targetDate: string, startTime?: string) => {
        set((state) => ({
            goals: sortGoals(state.goals.map((goal) =>
                goal.id === goalId
                    ? { ...goal, title, targetDate, startTime }
                    : goal
            )),
        }));
        api.updateGoal(goalId, { title, targetDate, startTime }).catch(console.error);
    },

    toggleGoal: (goalId: string) => {
        let newCompletedState = false;
        set((state) => ({
            goals: state.goals.map((goal) => {
                if (goal.id === goalId) {
                    newCompletedState = !goal.completed;
                    return { ...goal, completed: newCompletedState };
                }
                return goal;
            }),
        }));
        api.updateGoal(goalId, { completed: newCompletedState }).catch(console.error);
    },

    deleteGoal: (goalId: string) => {
        set((state) => ({
            goals: state.goals.filter((goal) => goal.id !== goalId),
        }));
        api.deleteGoal(goalId).catch(console.error);
    },

    // AI Memory actions
    addMemory: (fact: string) => {
        const newMemory: AIMemory = {
            id: generateId(),
            fact,
            createdAt: new Date().toISOString(),
        };
        set((state) => ({ aiMemory: [...state.aiMemory, newMemory] }));
        api.saveMemory(fact).catch(console.error);
    },

    addLearnedPattern: (pattern: string, confidence: number = 0.5) => {
        const newPattern: LearnedPattern = {
            id: generateId(),
            pattern,
            confidence,
            createdAt: new Date().toISOString(),
        };
        set((state) => ({ learnedPatterns: [...state.learnedPatterns, newPattern] }));
        // Note: Can be synced to backend if an API endpoint exists, keeping local for now.
    },

    updatePreferences: (newPrefs) => {
        set((state) => ({
            preferences: { ...state.preferences, ...newPrefs }
        }));

        // Sync to Supabase Profile
        api.updateProfile({
            hobbies: newPrefs.hobbies,
            interests: newPrefs.interests,
            passions: newPrefs.passions,
            work: newPrefs.work,
            // @ts-ignore - map to snake_case for DB
            sleep_start_time: newPrefs.sleepStartTime,
            // @ts-ignore - map to snake_case for DB
            sleep_end_time: newPrefs.sleepEndTime,
        }).catch(console.error);
    },

    // Calculated values (Unchanged)
    getDailyScore: () => {
        const state = get();
        const today = getTodayString();

        const relevantTasks = state.tasks.filter((t) => {
            const isCompletedToday = t.status === 'DONE' && t.completedAt?.startsWith(today);
            const isScheduledToday = t.scheduledDate === today;
            return isCompletedToday || isScheduledToday;
        });

        const countByType = (type: TaskType) => relevantTasks.filter((t) => t.type === type).length;
        const adultCount = countByType('ADULT');
        const childCount = countByType('CHILD');
        const restCount = countByType('REST');
        const total = adultCount + childCount + restCount;

        if (total === 0) {
            return { score: 50, balance: 'neutral' as const };
        }

        const adultRatio = adultCount / total;
        const childRatio = childCount / total;

        let balance: 'optimal' | 'anxiety' | 'depression' | 'neutral';
        let score: number;

        if (adultCount > 0 && childCount > 0) {
            const balanceRatio = Math.min(adultRatio, childRatio) / Math.max(adultRatio, childRatio);
            score = Math.round(60 + balanceRatio * 40);
            if (balanceRatio > 0.4) {
                balance = 'optimal';
            } else if (adultRatio > childRatio) {
                balance = 'anxiety';
            } else {
                balance = 'depression';
            }
        } else if (adultCount > 0 && childCount === 0) {
            score = Math.round(40 + Math.min(adultCount * 5, 20));
            balance = 'anxiety';
        } else if (childCount > 0 && adultCount === 0) {
            score = Math.round(40 + Math.min(childCount * 5, 20));
            balance = 'depression';
        } else {
            score = 50 + Math.min(restCount * 5, 30);
            balance = 'neutral';
        }

        score = Math.min(100, score);
        return { score, balance };
    },

    getTasksByStatus: (status: TaskStatus) => {
        return get().tasks.filter((task) => task.status === status);
    },

    exportData: () => {
        const state = get();
        const exportObj = {
            tasks: state.tasks,
            history: state.history,
            goals: state.goals,
            exportedAt: new Date().toISOString(),
        };
        return JSON.stringify(exportObj, null, 2);
    },

    importData: (jsonData: string) => {
        try {
            const data = JSON.parse(jsonData);
            if (data.tasks && data.history && data.goals) {
                set({
                    tasks: sortTasks(data.tasks),
                    history: sortHistory(data.history),
                    goals: sortGoals(data.goals),
                });
                return true;
            }
            return false;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    },
}),
{
    name: 'mindsync-storage',
    storage: createJSONStorage(() => localStorage),
    onRehydrateStorage: () => (state) => {
        if (state) state._hasHydrated = true;
    }
}
)
);
