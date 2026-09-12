import { db } from './db';
import { Task, Goal, DailySnapshot, AIMemory } from '@/types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const api = {
  async getTasks(): Promise<Task[]> {
    return db.getTasks();
  },

  async createTask(task: Omit<Task, 'id'>): Promise<Task> {
    const newTask = { ...task, id: generateId() } as Task;
    db.saveTask(newTask);
    return newTask;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const existing = db.getTasks().find(t => t.id === id);
    if (!existing) throw new Error('Task not found');
    const updated = { ...existing, ...updates, id } as Task;
    db.saveTask(updated);
    return updated;
  },

  async deleteTask(id: string): Promise<void> {
    db.deleteTask(id);
  },

  async getGoals(): Promise<Goal[]> {
    return db.getGoals();
  },

  async createGoal(goal: Omit<Goal, 'id'>): Promise<Goal> {
    const newGoal = { ...goal, id: generateId() } as Goal;
    db.saveGoal(newGoal);
    return newGoal;
  },

  async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
    const existing = db.getGoals().find(g => g.id === id);
    if (!existing) throw new Error('Goal not found');
    const updated = { ...existing, ...updates, id } as Goal;
    db.saveGoal(updated);
    return updated;
  },

  async deleteGoal(id: string): Promise<void> {
    db.deleteGoal(id);
  },

  async getDailyHistory(): Promise<DailySnapshot[]> {
    return db.getHistory();
  },

  async upsertDailyHistory(snapshot: DailySnapshot): Promise<void> {
    db.saveSnapshot(snapshot);
  },

  async getAIMemory(): Promise<AIMemory[]> {
    return db.getAiMemory();
  },

  async addAIMemory(item: Omit<AIMemory, 'id'>): Promise<AIMemory> {
    const newMemory = { ...item, id: generateId() } as AIMemory;
    db.addAiMemory(newMemory);
    return newMemory;
  },

  async clearAllData(): Promise<void> {
    db.clearAll();
  },
};

export default api;
