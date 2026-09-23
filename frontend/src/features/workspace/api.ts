import { request } from '../../shared/socket';

export type Entry = { path: string; name: string; kind: 'file' | 'directory' };
export type Document = { path: string; content: string; version: string };
export type Match = { path: string; line: number; text: string };
export type Change = { path: string; oldPath?: string; kind?: string; version?: string };

export const listDir = (path: string) => request<{ entries: Entry[] }>('list', { path }).then((r) => r.entries);
export const readFile = (path: string) => request<Document>('read', { path });
export const saveFile = (path: string, content: string, version: string) => request<{ version: string }>('save', { path, content, version });
export const createFile = (path: string) => request('create', { path });
export const createDir = (path: string) => request('mkdir', { path });
export const renamePath = (from: string, to: string) => request('rename', { from, to });
export const deletePath = (path: string) => request('delete', { path });
export const fileIndex = () => request<{ paths: string[]; truncated: boolean }>('index');
export const searchText = (query: string, signal?: AbortSignal) => request<{ matches: Match[]; truncated: boolean }>('search', { query }, signal);

export const parentOf = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
export const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
export const isWithin = (path: string, dir: string) => path === dir || path.startsWith(dir + '/');
