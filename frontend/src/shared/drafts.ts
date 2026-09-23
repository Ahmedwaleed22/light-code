// Unsaved text is mirrored to IndexedDB so it survives reloads, crashes, and discarded tabs.

export type Draft = { path: string; content: string; baseVersion: string };

let database: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('light-code', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('drafts', { keyPath: 'path' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return database;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = action(db.transaction('drafts', mode).objectStore('drafts'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putDraft = (draft: Draft) => run('readwrite', (store) => store.put(draft));
export const deleteDraft = (path: string) => run('readwrite', (store) => store.delete(path));
export const allDrafts = () => run<Draft[]>('readonly', (store) => store.getAll());
