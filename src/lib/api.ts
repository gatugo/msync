
import { supabase } from './supabase';
import { Task, Goal, DailySnapshot, AIMemory } from '@/types';
import { syncQueue } from './syncQueue';

// ============ SECURITY: Auth Guard Helper ============
async function requireAuth(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Unauthorized - User not authenticated');
    }
    return user.id;
}

// --- Retry Helper ---
const withRetry = async <T>(fn: () => Promise<T>, retries = 2, backoff = 500): Promise<T> => {
    try {
        return await fn();
    } catch (error: unknown) {
        const err = error as { status?: number };
        if (retries <= 0 || (err.status && err.status < 500 && err.status !== 408 && err.status !== 429)) {
            throw error;
        }
        await new Promise(resolve => setTimeout(resolve, backoff));
        return withRetry(fn, retries - 1, backoff * 2);
    }
};

// --- Mappers ---

const mapTaskFromDB = (row: Record<string, any>): Task => ({
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    duration: row.duration,
    createdAt: row.created_at,
    completedAt: row.completed_at,
});

const mapGoalFromDB = (row: Record<string, any>): Goal => ({
    id: row.id,
    title: row.title,
    targetDate: row.target_date,
    startTime: row.start_time,
    completed: row.completed,
    createdAt: row.created_at,
});

const mapMemoryFromDB = (row: Record<string, any>): AIMemory => ({
    id: row.id,
    fact: row.fact,
    createdAt: row.created_at,
});

// --- API Functions ---

export const api = {
    // PROFILES
    fetchProfile: async () => {
        return withRetry(async () => {
            const userId = await requireAuth();

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is 'not found', which is fine as valid user might not have profile yet
                console.error('Error fetching profile:', error);
                return null;
            }

            return data; // Returns { hobbies: [], show_goals: true, etc }
        });
    },

    updateProfile: async (updates: Partial<{ hobbies: string[]; interests: string[]; passions: string[]; work: string[]; sleepStartTime: string; sleepEndTime: string; aiEnabled: boolean }>) => {
        try {
            const userId = await requireAuth();

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);

            if (error) {
                // Ignore schema cache errors (like missing columns in older local schemas)
                if (!error.message?.includes('schema cache')) {
                    console.error('Error updating profile:', error.message || JSON.stringify(error));
                }
            }
        } catch (e) {
            // Likely not authenticated, safely ignore
        }
    },
    // TASKS
    fetchTasks: async () => {
        return withRetry(async () => {
            const userId = await requireAuth();

            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(500);
            if (error) throw error;
            return data.map(mapTaskFromDB);
        });
    },

    createTask: async (task: Task) => {
        try {
            const userId = await requireAuth();
            const payload = {
                id: task.id,
                title: task.title,
                type: task.type,
                status: task.status,
                scheduled_date: task.scheduledDate,
                scheduled_time: task.scheduledTime,
                duration: task.duration,
                created_at: task.createdAt,
                user_id: userId,
            };

            const { error } = await supabase.from('tasks').insert(payload);
            if (error) {
                console.warn('Network error, enqueuing task creation', error);
                syncQueue.enqueue({ method: 'insert', table: 'tasks', payload });
            }
        } catch (e) {
            console.error('Error creating task:', e);
        }
    },

    updateTask: async (taskId: string, updates: Partial<Task>) => {
        try {
            const userId = await requireAuth();

            // Map updates to snake_case
            const dbUpdates: Record<string, any> = {};
            if (updates.title) dbUpdates.title = updates.title;
            if (updates.status) dbUpdates.status = updates.status;
            if (updates.scheduledDate) dbUpdates.scheduled_date = updates.scheduledDate;
            if (updates.scheduledTime) dbUpdates.scheduled_time = updates.scheduledTime;
            if (updates.completedAt) dbUpdates.completed_at = updates.completedAt;
            if (updates.duration !== undefined) dbUpdates.duration = updates.duration;

            const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId).eq('user_id', userId);
            if (error) {
                console.warn('Network error, enqueuing task update');
                syncQueue.enqueue({
                    method: 'update',
                    table: 'tasks',
                    payload: dbUpdates,
                    filters: { id: taskId, user_id: userId }
                });
            }
        } catch (e) {
            console.error('Error updating task:', e);
        }
    },

    deleteTask: async (taskId: string) => {
        try {
            const userId = await requireAuth();

            const { error } = await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', userId);
            if (error) {
                console.warn('Network error, enqueuing task deletion');
                syncQueue.enqueue({
                    method: 'delete',
                    table: 'tasks',
                    payload: {},
                    filters: { id: taskId, user_id: userId }
                });
            }
        } catch (e) {
            console.error('Error deleting task:', e);
        }
    },

    // GOALS
    fetchGoals: async () => {
        return withRetry(async () => {
            const userId = await requireAuth();

            const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId);
            if (error) throw error;
            return data.map(mapGoalFromDB);
        });
    },

    createGoal: async (goal: Goal) => {
        try {
            const userId = await requireAuth();
            const payload = {
                id: goal.id,
                title: goal.title,
                target_date: goal.targetDate,
                start_time: goal.startTime,
                completed: goal.completed,
                created_at: goal.createdAt,
                user_id: userId,
            };

            const { error } = await supabase.from('goals').insert(payload);
            if (error) {
                console.warn('Network error, enqueuing goal creation');
                syncQueue.enqueue({ method: 'insert', table: 'goals', payload });
            }
        } catch (e) {
            console.error('Error creating goal:', e);
        }
    },

    updateGoal: async (goalId: string, updates: Partial<Goal>) => {
        try {
            const userId = await requireAuth();

            const dbUpdates: Record<string, any> = {};
            if (updates.title) dbUpdates.title = updates.title;
            if (updates.targetDate) dbUpdates.target_date = updates.targetDate;
            if (updates.startTime) dbUpdates.start_time = updates.startTime;
            if (updates.completed !== undefined) dbUpdates.completed = updates.completed;

            const { error } = await supabase.from('goals').update(dbUpdates).eq('id', goalId).eq('user_id', userId);
            if (error) {
                console.warn('Network error, enqueuing goal update');
                syncQueue.enqueue({
                    method: 'update',
                    table: 'goals',
                    payload: dbUpdates,
                    filters: { id: goalId, user_id: userId }
                });
            }
        } catch (e) {
            console.error('Error updating goal:', e);
        }
    },

    deleteGoal: async (goalId: string) => {
        try {
            const userId = await requireAuth();

            const { error } = await supabase.from('goals').delete().eq('id', goalId).eq('user_id', userId);
            if (error) {
                console.warn('Network error, enqueuing goal deletion');
                syncQueue.enqueue({
                    method: 'delete',
                    table: 'goals',
                    payload: {},
                    filters: { id: goalId, user_id: userId }
                });
            }
        } catch (e) {
            console.error('Error deleting goal:', e);
        }
    },

    // HISTORY
    fetchHistory: async (): Promise<DailySnapshot[]> => {
        return withRetry(async () => {
            const userId = await requireAuth();

            const { data, error } = await supabase
                .from('daily_history')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false })
                .limit(30); // Last 30 days

            if (error) {
                console.error('Error fetching history:', error);
                return [];
            }

            return (data || []).map((row: Record<string, any>) => ({
                date: row.date,
                score: row.score,
                adultCompleted: row.adult_completed,
                childCompleted: row.child_completed,
                restCompleted: row.rest_completed,
                tasks: row.snapshot_data || [],
            }));
        });
    },

    saveSnapshot: async (snapshot: DailySnapshot) => {
        try {
            const userId = await requireAuth();
            const payload = {
                date: snapshot.date,
                score: snapshot.score,
                adult_completed: snapshot.adultCompleted,
                child_completed: snapshot.childCompleted,
                rest_completed: snapshot.restCompleted,
                snapshot_data: snapshot.tasks,
                user_id: userId,
            };

            const { error } = await supabase.from('daily_history').upsert(payload);
            if (error) {
                console.warn('Network error, enqueuing snapshot save');
                syncQueue.enqueue({ method: 'upsert', table: 'daily_history', payload });
            }
        } catch (e) {
            console.error('Error saving snapshot:', e);
        }
    },

    // AI MEMORY
    fetchMemories: async (): Promise<AIMemory[]> => {
        return withRetry(async () => {
            try {
                const userId = await requireAuth();
                const { data, error } = await supabase
                    .from('ai_memory')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: true });

                if (error) throw error;
                return (data || []).map(mapMemoryFromDB);
            } catch (e) {
                console.error('Error fetching memories:', e);
                return [];
            }
        });
    },

    saveMemory: async (fact: string) => {
        try {
            const userId = await requireAuth();
            const payload = {
                user_id: userId,
                fact: fact
            };

            const { error } = await supabase.from('ai_memory').insert(payload);
            if (error) {
                console.warn('Network error, enqueuing memory save');
                syncQueue.enqueue({ method: 'insert', table: 'ai_memory', payload });
            }
        } catch (e) {
            console.error('Error saving memory:', e);
        }
    },

    deleteAllData: async () => {
        try {
            const userId = await requireAuth();
            await Promise.all([
                supabase.from('tasks').delete().eq('user_id', userId),
                supabase.from('goals').delete().eq('user_id', userId),
                supabase.from('daily_history').delete().eq('user_id', userId),
                supabase.from('ai_memory').delete().eq('user_id', userId)
            ]);
        } catch (e) {
            console.error('Error deleting all data:', e);
        }
    }
};
