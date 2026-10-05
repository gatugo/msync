import { Task, Goal, DailySnapshot, AIMemory, LearnedPattern, UserPreferences } from '@/types';

const STORAGE_KEYS = {
  tasks: 'mindsync_tasks',
  goals: 'mindsync_goals',
  history: 'mindsync_history',
  aiMemory: 'mindsync_ai_memory',
  learnedPatterns: 'mindsync_learned_patterns',
  preferences: 'mindsync_preferences',
  syncDeletions: 'mindsync_sync_deletions',
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

// --- sync: deletion tombstones (see src/lib/sync.ts) ---
export type SyncEntity = 'tasks' | 'goals' | 'snapshots' | 'memories' | 'patterns' | 'settings';

export interface DeletionQueueItem {
  entity: SyncEntity;
  appId: string;
  deletedAt: string;
}

let deletionsSuppressed = false;

/** Wraps remote-deletion application so pulled deletions don't re-enqueue locally. */
export function withDeletionsSuppressed<T>(fn: () => T): T {
  const prev = deletionsSuppressed;
  deletionsSuppressed = true;
  try {
    return fn();
  } finally {
    deletionsSuppressed = prev;
  }
}

const getDeletionQueue = (): DeletionQueueItem[] =>
  read<DeletionQueueItem[]>(STORAGE_KEYS.syncDeletions, []);

/** Removes one flushed tombstone so a partial push is never re-sent wholesale. */
const removeDeletion = (entity: SyncEntity, appId: string) => {
  const queue = getDeletionQueue().filter((t) => !(t.entity === entity && t.appId === appId));
  write(STORAGE_KEYS.syncDeletions, queue);
};

/** Called by every local delete; dedupes and keeps the queue bounded. */
const queueDeletion = (entity: DeletionQueueItem['entity'], appId: string) => {
  if (deletionsSuppressed || typeof window === 'undefined') return;
  const queue = getDeletionQueue();
  if (queue.some((t) => t.entity === entity && t.appId === appId)) return;
  queue.push({ entity, appId, deletedAt: new Date().toISOString() });
  write(STORAGE_KEYS.syncDeletions, queue.slice(-500));
};

/** Stamps updatedAt only when absent, so sync pull writes keep remote timestamps. */
function stampUpdatedAt<T extends object>(record: T): T & { updatedAt: string } {
  const r = record as T & { updatedAt?: string };
  if (r.updatedAt) return r as T & { updatedAt: string };
  return { ...r, updatedAt: new Date().toISOString() };
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
    const stamped = stampUpdatedAt(task);
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) tasks[idx] = stamped;
    else tasks.push(stamped);
    write(STORAGE_KEYS.tasks, sortTasks(tasks));
  },
  deleteTask: (id: string) => {
    const tasks = db.getTasks().filter((t) => t.id !== id);
    write(STORAGE_KEYS.tasks, tasks);
    queueDeletion('tasks', id);
  },

  // Goals
  getGoals: (): Goal[] => sortGoals(read<Goal[]>(STORAGE_KEYS.goals, [])),
  saveGoal: (goal: Goal) => {
    const goals = db.getGoals();
    const stamped = stampUpdatedAt(goal);
    const idx = goals.findIndex((g) => g.id === goal.id);
    if (idx >= 0) goals[idx] = stamped;
    else goals.push(stamped);
    write(STORAGE_KEYS.goals, sortGoals(goals));
  },
  deleteGoal: (id: string) => {
    const goals = db.getGoals().filter((g) => g.id !== id);
    write(STORAGE_KEYS.goals, goals);
    queueDeletion('goals', id);
  },

  // History
  getHistory: (): DailySnapshot[] => sortHistory(read<DailySnapshot[]>(STORAGE_KEYS.history, [])),
  saveSnapshot: (snapshot: DailySnapshot) => {
    const history = db.getHistory();
    const stamped = stampUpdatedAt(snapshot);
    const idx = history.findIndex((h) => h.date === snapshot.date);
    if (idx >= 0) history[idx] = stamped;
    else history.push(stamped);
    write(STORAGE_KEYS.history, sortHistory(history));
  },
  deleteSnapshot: (date: string) => {
    write(STORAGE_KEYS.history, db.getHistory().filter((h) => h.date !== date));
    queueDeletion('snapshots', date);
  },

  // AI Memory
  getAiMemory: (): AIMemory[] => read<AIMemory[]>(STORAGE_KEYS.aiMemory, []),
  addAiMemory: (memory: AIMemory) => {
    const memories = db.getAiMemory();
    memories.push(stampUpdatedAt(memory));
    write(STORAGE_KEYS.aiMemory, memories);
  },
  deleteAiMemory: (id: string) => {
    write(STORAGE_KEYS.aiMemory, db.getAiMemory().filter((m) => m.id !== id));
    queueDeletion('memories', id);
  },

  // Learned Patterns
  getLearnedPatterns: (): LearnedPattern[] => read<LearnedPattern[]>(STORAGE_KEYS.learnedPatterns, []),
  addLearnedPattern: (pattern: LearnedPattern) => {
    const patterns = db.getLearnedPatterns();
    patterns.push(stampUpdatedAt(pattern));
    write(STORAGE_KEYS.learnedPatterns, patterns);
  },
  deleteLearnedPattern: (id: string) => {
    write(STORAGE_KEYS.learnedPatterns, db.getLearnedPatterns().filter((p) => p.id !== id));
    queueDeletion('patterns', id);
  },

  // Preferences
  getPreferences: (): UserPreferences => read<UserPreferences>(STORAGE_KEYS.preferences, defaultPreferences),
  savePreferences: (prefs: Partial<UserPreferences>) => {
    const current = db.getPreferences();
    write(STORAGE_KEYS.preferences, {
      ...current,
      ...prefs,
      updatedAt: prefs.updatedAt || current.updatedAt || new Date().toISOString(),
    });
  },
  resetPreferences: () => {
    write(STORAGE_KEYS.preferences, defaultPreferences);
    queueDeletion('settings', 'preferences');
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

  // Bulk replace (import) — records lacking updatedAt get stamped now so imports win LWW
  replaceAllData: (tasks: Task[], goals: Goal[], history: DailySnapshot[]) => {
    write(STORAGE_KEYS.tasks, sortTasks(tasks.map(stampUpdatedAt)));
    write(STORAGE_KEYS.goals, sortGoals(goals.map(stampUpdatedAt)));
    write(STORAGE_KEYS.history, sortHistory(history.map(stampUpdatedAt)));
  },

  // Bulk delete — keeps the device-local StepFun API key (sync never manages it)
  clearAll: () => {
    const stepfun = db.getStepFunConfig();
    Object.values(STORAGE_KEYS).forEach((key) => {
      if (typeof window !== 'undefined') localStorage.removeItem(key);
    });
    if (typeof window !== 'undefined') {
      db.saveStepFunConfig(stepfun);
      window.localStorage.removeItem('mindsync_last_sync');
    }
  },

  // Sync deletion queue (tombstones; see src/lib/sync.ts)
  queueDeletion,
  getDeletionQueue,
  removeDeletion,
  clearDeletionQueue: () => write(STORAGE_KEYS.syncDeletions, []),
};
