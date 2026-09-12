import { Task, Goal, DailySnapshot, AIMemory, LearnedPattern, UserPreferences } from '@/types';

const STORAGE_KEYS = {
  tasks: 'mindsync_tasks',
  goals: 'mindsync_goals',
  history: 'mindsync_history',
  aiMemory: 'mindsync_ai_memory',
  learnedPatterns: 'mindsync_learned_patterns',
  preferences: 'mindsync_preferences',
  stepfunConfig: 'mindsync_stepfun_config',
};

export interface StepFunConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const defaultPreferences: UserPreferences = {
  hobbies: ['Reading', 'Hiking', 'Gaming'],
  interests: ['Technology', 'Art', 'Music'],
  passions: ['Learning', 'Creativity'],
  work: ['Software Dev', 'Management'],
  aiEnabled: true,
  autoArrangeTasks: false,
  forceOfflineMode: false,
};

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function sortTasks(tasks: Task[]): Task[] {
  const today = getTodayString();
  return [...tasks].sort((a, b) => {
    if (a.status === 'DONE' && b.status !== 'DONE') return 1;
    if (a.status !== 'DONE' && b.status === 'DONE') return -1;
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
}

function sortGoals(goals: Goal[]): Goal[] {
  const today = getTodayString();
  return [...goals].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const aOverdue = a.targetDate && a.targetDate < today && !a.completed;
    const bOverdue = b.targetDate && b.targetDate < today && !b.completed;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    const dateA = a.targetDate || '9999-99-99';
    const dateB = b.targetDate || '9999-99-99';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function sortHistory(history: DailySnapshot[]): DailySnapshot[] {
  return [...history].sort((a, b) => b.date.localeCompare(a.date));
}

export const db = {
  // Tasks
  getTasks: (): Task[] => sortTasks(read<Task[]>(STORAGE_KEYS.tasks, [])),
  saveTask: (task: Task) => {
    const tasks = db.getTasks();
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) tasks[idx] = task;
    else tasks.push(task);
    write(STORAGE_KEYS.tasks, sortTasks(tasks));
  },
  deleteTask: (id: string) => {
    const tasks = db.getTasks().filter((t) => t.id !== id);
    write(STORAGE_KEYS.tasks, tasks);
  },

  // Goals
  getGoals: (): Goal[] => sortGoals(read<Goal[]>(STORAGE_KEYS.goals, [])),
  saveGoal: (goal: Goal) => {
    const goals = db.getGoals();
    const idx = goals.findIndex((g) => g.id === goal.id);
    if (idx >= 0) goals[idx] = goal;
    else goals.push(goal);
    write(STORAGE_KEYS.goals, sortGoals(goals));
  },
  deleteGoal: (id: string) => {
    const goals = db.getGoals().filter((g) => g.id !== id);
    write(STORAGE_KEYS.goals, goals);
  },

  // History
  getHistory: (): DailySnapshot[] => sortHistory(read<DailySnapshot[]>(STORAGE_KEYS.history, [])),
  saveSnapshot: (snapshot: DailySnapshot) => {
    const history = db.getHistory();
    const idx = history.findIndex((h) => h.date === snapshot.date);
    if (idx >= 0) history[idx] = snapshot;
    else history.push(snapshot);
    write(STORAGE_KEYS.history, sortHistory(history));
  },

  // AI Memory
  getAiMemory: (): AIMemory[] => read<AIMemory[]>(STORAGE_KEYS.aiMemory, []),
  addAiMemory: (memory: AIMemory) => {
    const memories = db.getAiMemory();
    memories.push(memory);
    write(STORAGE_KEYS.aiMemory, memories);
  },

  // Learned Patterns
  getLearnedPatterns: (): LearnedPattern[] => read<LearnedPattern[]>(STORAGE_KEYS.learnedPatterns, []),
  addLearnedPattern: (pattern: LearnedPattern) => {
    const patterns = db.getLearnedPatterns();
    patterns.push(pattern);
    write(STORAGE_KEYS.learnedPatterns, patterns);
  },

  // Preferences
  getPreferences: (): UserPreferences => read<UserPreferences>(STORAGE_KEYS.preferences, defaultPreferences),
  savePreferences: (prefs: Partial<UserPreferences>) => {
    const current = db.getPreferences();
    write(STORAGE_KEYS.preferences, { ...current, ...prefs });
  },

  // StepFun Config
  getStepFunConfig: (): StepFunConfig => {
    const stored = read<Partial<StepFunConfig>>(STORAGE_KEYS.stepfunConfig, {});
    return {
      apiKey: stored.apiKey || '',
      baseUrl: stored.baseUrl || 'https://api.stepfun.ai/step_plan/v1',
      model: stored.model || 'step-3.5-flash',
    };
  },
  saveStepFunConfig: (config: Partial<StepFunConfig>) => {
    const current = db.getStepFunConfig();
    write(STORAGE_KEYS.stepfunConfig, { ...current, ...config });
  },

  // Bulk delete
  clearAll: () => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      if (typeof window !== 'undefined') localStorage.removeItem(key);
    });
  },
};
