import { getJSON } from '../../shared/api/client';

export type Entry = { path: string; name: string; kind: 'file' | 'directory' };
export type Document = { path: string; content: string; version: string };

async function sendJSON<T>(method: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error((await response.text()).trim() || `Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const listFiles = () => getJSON<Entry[]>('/api/files');
export const readFile = (path: string) => getJSON<Document>(`/api/file?path=${encodeURIComponent(path)}`);
export const createFile = (path: string) => sendJSON<{ path: string }>('POST', '/api/files', { path });
export const saveFile = (doc: Document) => sendJSON<Document>('PUT', '/api/file', doc);
