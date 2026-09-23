import { computed, signal } from '@preact/signals';
import { loadSession, saveSession } from '../../shared/session';
import { on, onReconnect, RpcError } from '../../shared/socket';
import { applyDelete, applyRename, notice, openFile } from '../editor/state';
import { baseName, createDir, createFile, deletePath, isWithin, listDir, parentOf, renamePath, type Change, type Entry } from '../workspace/api';

// Directories load lazily when expanded, so huge folders cost nothing until opened.
export const children = signal(new Map<string, Entry[]>());
export const expanded = signal(new Set<string>(loadSession().expanded));
export const selected = signal<string | null>(null);
export const editing = signal<{ mode: 'create'; kind: Entry['kind']; parent: string } | { mode: 'rename'; path: string } | null>(null);

export type Row = { type: 'entry'; entry: Entry; depth: number } | { type: 'input'; depth: number };

export const rows = computed(() => {
  const out: Row[] = [];
  const edit = editing.value;
  const walk = (dir: string, depth: number) => {
    if (edit?.mode === 'create' && edit.parent === dir) out.push({ type: 'input', depth });
    for (const entry of children.value.get(dir) ?? []) {
      out.push({ type: 'entry', entry, depth });
      if (entry.kind === 'directory' && expanded.value.has(entry.path)) walk(entry.path, depth + 1);
    }
  };
  walk('', 0);
  return out;
});

function persistExpanded() {
  saveSession({ expanded: [...expanded.value] });
}

export async function loadDir(dir: string) {
  try {
    const entries = await listDir(dir);
    children.value = new Map(children.value).set(dir, entries);
  } catch (error) {
    const next = new Map(children.value);
    next.delete(dir);
    children.value = next;
    if (dir === '') notice.value = `Cannot list workspace: ${(error as Error).message}`;
    else if (expanded.value.has(dir)) { const set = new Set(expanded.value); set.delete(dir); expanded.value = set; persistExpanded(); }
  }
}

export function refreshTree() {
  const dirs = ['', ...[...expanded.value]];
  const next = new Map(children.value);
  for (const key of next.keys()) if (!dirs.includes(key)) next.delete(key);
  children.value = next;
  return Promise.all(dirs.map(loadDir));
}

export async function setExpanded(dir: string, open: boolean) {
  const set = new Set(expanded.value);
  if (open) set.add(dir); else set.delete(dir);
  expanded.value = set;
  persistExpanded();
  if (open && !children.value.has(dir)) await loadDir(dir);
}

export function collapseAll() {
  expanded.value = new Set();
  persistExpanded();
}

function targetDir() {
  const path = selected.value;
  if (!path) return '';
  const entry = [...children.value.values()].flat().find((item) => item.path === path);
  return entry?.kind === 'directory' ? path : parentOf(path);
}

export async function startCreate(kind: Entry['kind'], parent = targetDir()) {
  if (parent) await setExpanded(parent, true);
  editing.value = { mode: 'create', kind, parent };
}

export function startRename(path: string) {
  editing.value = { mode: 'rename', path };
}

function report(error: unknown, action: string) {
  notice.value = `${action}: ${(error as Error).message}`;
  if (error instanceof RpcError && error.code === 'disconnected') void refreshTree();
}

export async function commitEdit(name: string) {
  const edit = editing.value;
  editing.value = null;
  name = name.trim();
  if (!edit || !name) return;
  if (name.includes('/') || name === '.' || name === '..') { notice.value = 'Names cannot contain "/".'; return; }
  if (edit.mode === 'create') {
    const path = edit.parent ? `${edit.parent}/${name}` : name;
    try {
      await (edit.kind === 'file' ? createFile(path) : createDir(path));
      await loadDir(edit.parent);
      selected.value = path;
      if (edit.kind === 'file') await openFile(path);
    } catch (error) { report(error, `Cannot create ${name}`); }
    return;
  }
  if (name === baseName(edit.path)) return;
  const parent = parentOf(edit.path);
  const to = parent ? `${parent}/${name}` : name;
  try {
    await renamePath(edit.path, to);
    moved(edit.path, to);
    applyRename(edit.path, to);
    selected.value = to;
  } catch (error) { report(error, `Cannot rename ${baseName(edit.path)}`); }
}

export async function remove(path: string) {
  if (!confirm(`Delete "${baseName(path)}"${children.value.has(path) || expanded.value.has(path) ? ' and its contents' : ''}? This cannot be undone.`)) return;
  try {
    await deletePath(path);
    gone(path);
    applyDelete(path);
  } catch (error) { report(error, `Cannot delete ${baseName(path)}`); }
}

// Keeps cached listings and expansion state consistent after a move or delete.
function gone(path: string) {
  const next = new Map(children.value);
  for (const key of next.keys()) if (key && isWithin(key, path)) next.delete(key);
  children.value = next;
  const set = new Set([...expanded.value].filter((dir) => !isWithin(dir, path)));
  if (set.size !== expanded.value.size) { expanded.value = set; persistExpanded(); }
  if (selected.value && isWithin(selected.value, path)) selected.value = null;
  if (children.value.has(parentOf(path))) void loadDir(parentOf(path));
}

function moved(from: string, to: string) {
  const reopen = [...expanded.value].filter((dir) => isWithin(dir, from)).map((dir) => to + dir.slice(from.length));
  gone(from);
  if (reopen.length) { expanded.value = new Set([...expanded.value, ...reopen]); persistExpanded(); }
  if (children.value.has(parentOf(to))) void loadDir(parentOf(to));
  reopen.forEach((dir) => void loadDir(dir));
}

export function watchExplorerChanges() {
  const stop = [on('files.created', (change: Change) => { if (children.value.has(parentOf(change.path))) void loadDir(parentOf(change.path)); }),
    on('files.deleted', (change: Change) => gone(change.path)),
    on('files.renamed', (change: Change) => moved(change.oldPath!, change.path)),
    onReconnect(() => void refreshTree())];
  return () => stop.forEach((unsubscribe) => unsubscribe());
}
