import type { Position } from "@/lib/geo";

export interface QueuedFile {
  id: string;
  blob: Blob;
  capturedAt: string;
  durationSeconds?: number;
}

export interface QueuedEntry {
  id: string;
  siteId: string;
  siteName: string;
  capturedAt: string;
  localDate: string;
  timezone: string;
  location: Position | null;
  audio: QueuedFile;
  photos: QueuedFile[];
  queuedAt: string;
  error?: string;
}

const DB_NAME = "argos";
const STORE = "entry-queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable."));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB failed."));
    });
  } finally {
    db.close();
  }
}

const changed = () => window.dispatchEvent(new Event("argos:queue-changed"));

export const enqueueEntry = (entry: QueuedEntry) =>
  run("readwrite", (store) => store.put(entry)).then(() => {
    changed();
  });

export async function listQueue(): Promise<QueuedEntry[]> {
  const items = await run<QueuedEntry[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedEntry[]>);
  return items.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export const removeQueued = (id: string) =>
  run("readwrite", (store) => store.delete(id)).then(() => {
    changed();
  });
