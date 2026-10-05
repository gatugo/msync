import { create } from 'zustand';
import { db } from '@/lib/db';
import {
  currentUser,
  getPbUrl,
  isSignedIn,
  setPbUrl as pbSetPbUrl,
  signIn as pbSignIn,
  signOut as pbSignOut,
  syncNow as pbSyncNow,
} from '@/lib/sync';
import type { SyncUser } from '@/lib/sync';
import { isoToLocalDateKey } from '@/lib/localDate';
import { Task, Goal, DailySnapshot, TaskType, TaskStatus, UserPreferences, AIMemory, LearnedPattern } from '@/types';

const getTodayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const sortTasks = (tasks: Task[]): Task[] => {
  return [...tasks].sort((a, b) => {
    if (a.status === 'DONE' && b.status !== 'DONE') return 1;
    if (a.status !== 'DONE' && b.status === 'DONE') return -1;
    const today = getTodayString();
    const aOverdue = a.scheduledDate && a.scheduledDate < today && a.status !== 'DONE';
    const bOverdue = b.scheduledDate && b.scheduledDate < today && b.status !== 'DONE';
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    const dateA = a.scheduledDate || '9999-99-99';
    const dateB = b.scheduledDate || '9999-99-99';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.scheduledTime || '23:59:59';
    const timeB = b.scheduledTime || '23:59:59';
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    const typePriority = { ADULT: 1, CHILD: 2, REST: 3 };
    const priorityA = typePriority[a.type] || 99;
    const priorityB = typePriority[b.type] || 99;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.createdAt.localeCompare(b.createdAt);
  });
};

const sortGoals = (goals: Goal[]): Goal[] => {
  return [...goals].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const today = getTodayString();
    const aOverdue = a.targetDate && a.targetDate < today && !a.completed;
    const bOverdue = b.targetDate && b.targetDate < today && !b.completed;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    const dateA = a.targetDate || '9999-99-99';
    const dateB = b.targetDate || '9999-99-99';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.createdAt.localeCompare(b.createdAt);
  });
};

const sortHistory = (history: DailySnapshot[]): DailySnapshot[] => {
  return [...history].sort((a, b) => b.date.localeCompare(a.date));
};

let saveSnapshotTimeout: NodeJS.Timeout | null = null;

export interface StoreState {
  isOnline: boolean;
  setIsOnline: (status: boolean) => void;
  tasks: Task[];
  addTask: (title: string, type: TaskType, date?: string, time?: string, duration?: number) => void;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  deleteTask: (taskId: string) => void;
  updateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'scheduledDate' | 'scheduledTime' | 'duration'>>) => void;
  clearCompletedTasks: () => void;
  history: DailySnapshot[];
  saveDailySnapshot: () => void;
  goals: Goal[];
  addGoal: (title: string, targetDate: string, startTime?: string) => void;
  editGoal: (goalId: string, title: string, targetDate: string, startTime?: string) => void;
  toggleGoal: (goalId: string) => void;
  deleteGoal: (goalId: string) => void;
  aiMemory: AIMemory[];
  addMemory: (fact: string) => void;
  learnedPatterns: LearnedPattern[];
  addLearnedPattern: (pattern: string, confidence?: number) => void;
  preferences: UserPreferences;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  getDailyScore: () => { score: number; balance: 'optimal' | 'anxiety' | 'depression' | 'neutral' };
  getTasksByStatus: (status: TaskStatus) => Task[];
  exportData: () => string;
  importData: (jsonData: string) => boolean;
  // --- sync (PocketBase) ---
  syncUser: SyncUser | null;
  syncStatus: 'idle' | 'syncing' | 'signed-out' | 'error';
  syncError: string | null;
  lastSyncAt: string | null;
  pbUrl: string;
  signIn: (email: string, password: string) => Promise<void>;
  syncNow: () => Promise<void>;
  signOut: () => void;
  setPbUrl: (url: string) => void;
  _hasHydrated: boolean;
  fetchInitialData: () => Promise<void>;
  resetStore: () => void;
  clearAllData: () => Promise<void>;
}

export const useStore = create<StoreState>()((set, get) => ({
  tasks: [],
  history: [],
  goals: [],
  aiMemory: [],
  learnedPatterns: [],
  _hasHydrated: false,
  preferences: db.getPreferences(),
  syncUser: null,
  syncStatus: 'signed-out',
  syncError: null,
  lastSyncAt: null,
  pbUrl: getPbUrl(),

  isOnline: true,
  setIsOnline: (status) => set({ isOnline: status }),

  fetchInitialData: async () => {
    // Hydrate in-memory state from the localStorage cache (fixes empty state on reload)
    const hydrate = () =>
      set({
        tasks: db.getTasks(),
        goals: db.getGoals(),
        history: db.getHistory(),
        aiMemory: db.getAiMemory(),
        learnedPatterns: db.getLearnedPatterns(),
        preferences: db.getPreferences(),
      });
    hydrate();
    set({ _hasHydrated: true });

    // Auto-sync when previously signed in; offline/backend-down is a silent no-op
    if (isSignedIn()) {
      set({ syncUser: currentUser() });
      try {
        await get().syncNow();
        hydrate();
      } catch {
        // local cache remains authoritative
      }
    }
  },

  signIn: async (email, password) => {
    set({ syncStatus: 'syncing', syncError: null });
    try {
      const user = await pbSignIn(email, password);
      set({ syncUser: user });
      await get().syncNow();
      set({
        tasks: db.getTasks(),
        goals: db.getGoals(),
        history: db.getHistory(),
        aiMemory: db.getAiMemory(),
        learnedPatterns: db.getLearnedPatterns(),
        preferences: db.getPreferences(),
      });
    } catch (e) {
      set({ syncStatus: 'error', syncError: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },

  syncNow: async () => {
    set({ syncStatus: 'syncing', syncError: null });
    try {
      await pbSyncNow();
      set({
        tasks: db.getTasks(),
        goals: db.getGoals(),
        history: db.getHistory(),
        aiMemory: db.getAiMemory(),
        learnedPatterns: db.getLearnedPatterns(),
        preferences: db.getPreferences(),
        syncStatus: 'idle',
        lastSyncAt: new Date().toISOString(),
      });
    } catch (e) {
      set({ syncStatus: 'error', syncError: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },

  signOut: () => {
    pbSignOut();
    set({ syncUser: null, syncStatus: 'signed-out', syncError: null });
  },

  setPbUrl: (url) => {
    pbSetPbUrl(url);
    set({ pbUrl: getPbUrl(), syncError: null });
  },

  resetStore: () => {
    set({
      tasks: [],
      history: [],
      goals: [],
      aiMemory: [],
      _hasHydrated: true,
      preferences: db.getPreferences(),
    });
  },

  clearAllData: async () => {
    const state = get();
    // Sync-aware erase: if signed in, tombstone everything (so other devices and
    // the server also forget it) + sync, then sign out — otherwise the next sync
    // would resurrect the "erased" data from the server.
    let synced = true;
    if (isSignedIn()) {
      state.tasks.forEach((t) => db.queueDeletion('tasks', t.id));
      state.goals.forEach((g) => db.queueDeletion('goals', g.id));
      state.history.forEach((h) => db.queueDeletion('snapshots', h.date));
      state.aiMemory.forEach((m) => db.queueDeletion('memories', m.id));
      state.learnedPatterns.forEach((p) => db.queueDeletion('patterns', p.id));
      db.queueDeletion('settings', 'preferences');
      try {
        await pbSyncNow();
      } catch {
        synced = false;
        // offline: tombstones must survive the local wipe below
      }
      pbSignOut();
    }
    set({
      tasks: [],
      history: [],
      goals: [],
      aiMemory: [],
      learnedPatterns: [],
      preferences: db.getPreferences(),
      syncUser: null,
      syncStatus: 'signed-out',
      syncError: null,
      lastSyncAt: null,
    });
    db.clearAll(); // preserves the device-local StepFun key; resets sync markers
    if (!synced) {
      // re-arm the tombstones that couldn't be pushed while offline
      state.tasks.forEach((t) => db.queueDeletion('tasks', t.id));
      state.goals.forEach((g) => db.queueDeletion('goals', g.id));
      state.history.forEach((h) => db.queueDeletion('snapshots', h.date));
      state.aiMemory.forEach((m) => db.queueDeletion('memories', m.id));
      state.learnedPatterns.forEach((p) => db.queueDeletion('patterns', p.id));
      db.queueDeletion('settings', 'preferences');
    }
  },

  addTask: (title, type, date, time, duration) => {
    const newTask: Task = {
      id: generateId(),
      title,
      type,
      status: 'TODO',
      scheduledDate: date || getTodayString(),
      scheduledTime: time,
      duration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({ tasks: sortTasks([...state.tasks, newTask]) }));
    get().saveDailySnapshot();
    db.saveTask(newTask);
  },

  moveTask: (taskId, newStatus) => {
    const now = new Date().toISOString();
    const completedAt = newStatus === 'DONE' ? now : undefined;
    set((state) => ({
      tasks: sortTasks(
        state.tasks.map((task) =>
          task.id === taskId ? { ...task, status: newStatus, completedAt: newStatus === 'DONE' ? completedAt : task.completedAt, updatedAt: now } : task
        )
      ),
    }));
    get().saveDailySnapshot();
    const task = get().tasks.find((t) => t.id === taskId);
    if (task) db.saveTask({ ...task, status: newStatus, completedAt, updatedAt: now });
  },

  deleteTask: (taskId) => {
    set((state) => ({ tasks: state.tasks.filter((task) => task.id !== taskId) }));
    get().saveDailySnapshot();
    db.deleteTask(taskId);
  },

  updateTask: (taskId, updates) => {
    const now = new Date().toISOString();
    set((state) => ({
      tasks: sortTasks(
        state.tasks.map((task) => task.id === taskId ? { ...task, ...updates, updatedAt: now } : task)
      ),
    }));
    get().saveDailySnapshot();
    const task = get().tasks.find((t) => t.id === taskId);
    if (task) db.saveTask({ ...task, ...updates, updatedAt: now });
  },

  clearCompletedTasks: () => {
    const state = get();
    const doneTasks = state.tasks.filter((t) => t.status === 'DONE');
    doneTasks.forEach((task) => db.deleteTask(task.id));
    set((state) => ({ tasks: sortTasks(state.tasks.filter((task) => task.status !== 'DONE')) }));
    get().saveDailySnapshot();
  },

  saveDailySnapshot: () => {
    if (saveSnapshotTimeout) clearTimeout(saveSnapshotTimeout);
    const flushSnapshot = () => {
      const state = get();
      const today = getTodayString();
      const { score } = state.getDailyScore();
      const completedTasks = state.tasks.filter((t) => t.status === 'DONE');
      const snapshot: DailySnapshot = {
        date: today,
        tasks: [...state.tasks],
        score,
        adultCompleted: completedTasks.filter((t) => t.type === 'ADULT').length,
        childCompleted: completedTasks.filter((t) => t.type === 'CHILD').length,
        restCompleted: completedTasks.filter((t) => t.type === 'REST').length,
        updatedAt: new Date().toISOString(),
      };
      set((currentState) => {
        const existingIndex = currentState.history.findIndex((h) => h.date === today);
        const newHistory = [...currentState.history];
        if (existingIndex >= 0) newHistory[existingIndex] = snapshot;
        else newHistory.push(snapshot);
        return { history: sortHistory(newHistory) };
      });
      db.saveSnapshot(snapshot);
    };
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
    }, 1500);
  },

  addGoal: (title, targetDate, startTime) => {
    const newGoal: Goal = {
      id: generateId(),
      title,
      targetDate,
      startTime,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({ goals: sortGoals([...state.goals, newGoal]) }));
    db.saveGoal(newGoal);
  },

  editGoal: (goalId, title, targetDate, startTime) => {
    const now = new Date().toISOString();
    set((state) => ({
      goals: sortGoals(
        state.goals.map((goal) => goal.id === goalId ? { ...goal, title, targetDate, startTime, updatedAt: now } : goal)
      ),
    }));
    const goal = get().goals.find((g) => g.id === goalId);
    if (goal) db.saveGoal({ ...goal, title, targetDate, startTime, updatedAt: now });
  },

  toggleGoal: (goalId) => {
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
    if (newCompletedState) {
      const goal = get().goals.find((g) => g.id === goalId);
      if (goal) db.saveGoal({ ...goal, completed: true, updatedAt: new Date().toISOString() });
    }
  },

  deleteGoal: (goalId) => {
    set((state) => ({ goals: state.goals.filter((goal) => goal.id !== goalId) }));
    get().saveDailySnapshot();
    db.deleteGoal(goalId);
  },

  addMemory: (fact) => {
    const now = new Date().toISOString();
    const newMemory: AIMemory = { id: generateId(), fact, createdAt: now, updatedAt: now };
    set((state) => ({ aiMemory: [...state.aiMemory, newMemory] }));
    db.addAiMemory(newMemory);
  },

  addLearnedPattern: (pattern, confidence = 0.5) => {
    const now = new Date().toISOString();
    const newPattern: LearnedPattern = { id: generateId(), pattern, confidence, createdAt: now, updatedAt: now };
    set((state) => ({ learnedPatterns: [...state.learnedPatterns, newPattern] }));
    db.addLearnedPattern(newPattern);
  },

  updatePreferences: (newPrefs) => {
    set((state) => ({ preferences: { ...state.preferences, ...newPrefs, updatedAt: new Date().toISOString() } }));
    db.savePreferences({ ...newPrefs, updatedAt: new Date().toISOString() });
  },

  getDailyScore: () => {
    const state = get();
    const today = getTodayString();
    const relevantTasks = state.tasks.filter((t) => {
      const isCompletedToday = t.status === 'DONE' && isoToLocalDateKey(t.completedAt) === today;
      const isScheduledToday = t.scheduledDate === today;
      return isCompletedToday || isScheduledToday;
    });
    const countByType = (type: TaskType) => relevantTasks.filter((t) => t.type === type).length;
    const adultCount = countByType('ADULT');
    const childCount = countByType('CHILD');
    const restCount = countByType('REST');
    const total = adultCount + childCount + restCount;
    if (total === 0) return { score: 50, balance: 'neutral' as const };
    const adultRatio = adultCount / total;
    const childRatio = childCount / total;
    let balance: 'optimal' | 'anxiety' | 'depression' | 'neutral';
    let score: number;
    if (adultCount > 0 && childCount > 0) {
      const balanceRatio = Math.min(adultRatio, childRatio) / Math.max(adultRatio, childRatio);
      score = Math.round(60 + balanceRatio * 40);
      if (balanceRatio > 0.4) balance = 'optimal';
      else if (adultRatio > childRatio) balance = 'anxiety';
      else balance = 'depression';
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

  getTasksByStatus: (status) => get().tasks.filter((task) => task.status === status),

  exportData: () => {
    const state = get();
    return JSON.stringify({ tasks: state.tasks, history: state.history, goals: state.goals, exportedAt: new Date().toISOString() }, null, 2);
  },

  importData: (jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      if (data.tasks && data.history && data.goals) {
        // Persist through the local cache — memory-only imports are lost on the
        // next reload/sync now that db is the source of truth.
        const oldTasks = db.getTasks();
        const oldGoals = db.getGoals();
        const newTaskIds = new Set((data.tasks as Task[]).map((t) => t.id));
        const newGoalIds = new Set((data.goals as Goal[]).map((g) => g.id));

        db.replaceAllData(data.tasks as Task[], data.goals as Goal[], data.history as DailySnapshot[]);
        // tell other devices about records the import removed
        oldTasks.forEach((t) => { if (!newTaskIds.has(t.id)) db.queueDeletion('tasks', t.id); });
        oldGoals.forEach((g) => { if (!newGoalIds.has(g.id)) db.queueDeletion('goals', g.id); });

        set({
          tasks: db.getTasks(),
          history: db.getHistory(),
          goals: db.getGoals(),
        });
        // best-effort: push the import (and its tombstones) when signed in
        if (isSignedIn()) get().syncNow().catch(() => { /* surfaced later */ });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  },
}));
