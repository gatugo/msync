
import { supabase } from './supabase';

interface QueueItem {
    id: string;
    method: 'insert' | 'update' | 'upsert' | 'delete';
    table: string;
    payload: Record<string, unknown> | Record<string, unknown>[];
    filters?: Record<string, unknown>;
    timestamp: number;
}

class SyncQueue {
    private queue: QueueItem[] = [];
    private isProcessing = false;
    private storageKey = 'mindsync-sync-queue';

    constructor() {
        if (typeof window !== 'undefined') {
            this.loadQueue();
            window.addEventListener('online', () => this.processQueue());
        }
    }

    private loadQueue() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                this.queue = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to parse sync queue', e);
            }
        }
    }

    private saveQueue() {
        if (typeof window === 'undefined') return;
        
        Promise.resolve().then(() => {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
            } catch (e) {
                console.error('Failed to save sync queue to localStorage, quota might be exceeded', e);
            }
        });
    }

    async enqueue(item: Omit<QueueItem, 'id' | 'timestamp'>) {
        const newItem: QueueItem = {
            ...item,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
        };
        this.queue.push(newItem);
        this.saveQueue();
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const item = this.queue[0];
            const success = await this.performSync(item);

            if (success) {
                this.queue.shift();
                this.saveQueue();
            } else {
                // If it failed due to network, stop processing and wait for next online event
                // Also schedule a retry in case we're still online but the server had a temporary hiccup
                setTimeout(() => this.processQueue(), 10000);
                break;
            }
        }

        this.isProcessing = false;
    }

    private async performSync(item: QueueItem): Promise<boolean> {
        try {
            let query = supabase.from(item.table);

            switch (item.method) {
                case 'insert':
                    const { error: insertError } = await query.insert(item.payload);
                    if (insertError) throw insertError;
                    break;
                case 'update':
                    let updateQuery = query.update(item.payload);
                    if (item.filters) {
                        for (const [key, value] of Object.entries(item.filters)) {
                            updateQuery = updateQuery.eq(key, value);
                        }
                    }
                    const { error: updateError } = await updateQuery;
                    if (updateError) throw updateError;
                    break;
                case 'upsert':
                    const { error: upsertError } = await query.upsert(item.payload);
                    if (upsertError) throw upsertError;
                    break;
                case 'delete':
                    let deleteQuery = query.delete();
                    if (item.filters) {
                        for (const [key, value] of Object.entries(item.filters)) {
                            deleteQuery = deleteQuery.eq(key, value);
                        }
                    }
                    const { error: deleteError } = await deleteQuery;
                    if (deleteError) throw deleteError;
                    break;
            }
            return true;
        } catch (error: unknown) {
            const err = error as { status?: number; message?: string };
            console.error(`Sync failed for ${item.table} ${item.method}:`, err.message || err);
            // If it's a permanent error (e.g. 400 Bad Request), we might want to discard it
            // but if it's a network error (e.g. timeout, 503), we return false to retry later
            if (err.status && err.status < 500 && err.status !== 408 && err.status !== 429) {
                console.warn('Discarding invalid sync item');
                return true; 
            }
            return false;
        }
    }
}

export const syncQueue = new SyncQueue();
