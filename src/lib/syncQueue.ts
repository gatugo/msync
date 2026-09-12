// Sync queue is not used in local-first mode.
// Kept as a no-op shim for compatibility.

type QueueItem = {
  id: string;
  table: string;
  action: string;
  data: unknown;
};

class SyncQueue {
  private items: QueueItem[] = [];
  add(_item: QueueItem) {}
  flush() {}
}

export const syncQueue = new SyncQueue();
