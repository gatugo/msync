export type TaskType = 'ADULT' | 'CHILD' | 'REST';
export type TaskStatus = 'TODO' | 'START' | 'DONE';

export interface UserPreferences {
    hobbies: string[];
    interests: string[];
    passions: string[];
    work: string[];
    sleepStartTime?: string; // HH:MM
    sleepEndTime?: string; // HH:MM
    aiEnabled?: boolean;
    autoArrangeTasks?: boolean;
    forceOfflineMode?: boolean;
}

export interface LearnedPattern {
    id: string;
    pattern: string;
    confidence: number; // 0.0 to 1.0
    createdAt: string;
    lastApplied?: string;
}

export interface Task {
    id: string;
    title: string;
    type: TaskType;
    status: TaskStatus;
    scheduledDate?: string; // Optional scheduled date
    scheduledTime?: string; // Optional scheduled time
    duration?: number; // Optional duration in minutes
    createdAt: string;
    completedAt?: string;
    user_id?: string;
}

export interface DailySnapshot {
    date: string; // YYYY-MM-DD format
    tasks: Task[];
    score: number;
    adultCompleted: number;
    childCompleted: number;
    restCompleted: number;
}

export interface Goal {
    id: string;
    title: string;
    titleDate?: string; // Deprecated but might exist in old data
    targetDate: string;
    startTime?: string; // Optional start time (HH:MM format)
    completed: boolean;
    createdAt: string;
    user_id?: string;
}

export interface AIMemory {
    id: string;
    fact: string;
    createdAt: string;
    user_id?: string;
}
