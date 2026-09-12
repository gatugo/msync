import { create } from 'zustand';
import { db } from '@/lib/db';
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

  isOnline: true,
  setIsOnline: (status) => set({ isOnline: status }),

  fetchInitialData: async () => {
    set({ _hasHydrated: true });
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
    set({ tasks: [], history: [], goals: [], aiMemory: [] });
    db.clearAll();
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
    };
    set((state) => ({ tasks: sortTasks([...state.tasks, newTask]) }));
    get().saveDailySnapshot();
    db.saveTask(newTask);
  },

  moveTask: (taskId, newStatus) => {
    const completedAt = newStatus === 'DONE' ? new Date().toISOString() : undefined;
    set((state) => ({
      tasks: sortTasks(
        state.tasks.map((task) =>
          task.id === taskId ? { ...task, status: newStatus, completedAt: newStatus === 'DONE' ? completedAt : task.completedAt } : task
        )
      ),
    }));
    get().saveDailySnapshot();
    const task = get().tasks.find((t) => t.id === taskId);
    if (task) db.saveTask({ ...task, status: newStatus, completedAt });
  },

  deleteTask: (taskId) => {
    set((state) => ({ tasks: state.tasks.filter((task) => task.id !== taskId) }));
    get().saveDailySnapshot();
    db.deleteTask(taskId);
  },

  updateTask: (taskId, updates) => {
    set((state) => ({
      tasks: sortTasks(
        state.tasks.map((task) => task.id === taskId ? { ...task, ...updates } : task)
      ),
    }));
    get().saveDailySnapshot();
    const task = get().tasks.find((t) => t.id === taskId);
    if (task) db.saveTask({ ...task, ...updates });
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
    };
    set((state) => ({ goals: sortGoals([...state.goals, newGoal]) }));
    db.saveGoal(newGoal);
  },

  editGoal: (goalId, title, targetDate, startTime) => {
    set((state) => ({
      goals: sortGoals(
        state.goals.map((goal) => goal.id === goalId ? { ...goal, title, targetDate, startTime } : goal)
      ),
    }));
    const goal = get().goals.find((g) => g.id === goalId);
    if (goal) db.saveGoal({ ...goal, title, targetDate, startTime });
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
      if (goal) db.saveGoal({ ...goal, completed: true });
    }
  },

  deleteGoal: (goalId) => {
    set((state) => ({ goals: state.goals.filter((goal) => goal.id !== goalId) }));
    get().saveDailySnapshot();
    db.deleteGoal(goalId);
  },

  addMemory: (fact) => {
    const newMemory: AIMemory = { id: generateId(), fact, createdAt: new Date().toISOString() };
    set((state) => ({ aiMemory: [...state.aiMemory, newMemory] }));
    db.addAiMemory(newMemory);
  },

  addLearnedPattern: (pattern, confidence = 0.5) => {
    const newPattern: LearnedPattern = { id: generateId(), pattern, confidence, createdAt: new Date().toISOString() };
    set((state) => ({ learnedPatterns: [...state.learnedPatterns, newPattern] }));
    db.addLearnedPattern(newPattern);
  },

  updatePreferences: (newPrefs) => {
    set((state) => ({ preferences: { ...state.preferences, ...newPrefs } }));
    db.savePreferences(newPrefs);
  },

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
        set({ tasks: sortTasks(data.tasks), history: sortHistory(data.history), goals: sortGoals(data.goals) });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  },
}));
