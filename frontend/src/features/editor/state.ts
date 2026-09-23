import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Annotation, Compartment, EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state';
import {
  crosshairCursor, drawSelection, dropCursor, EditorView, highlightActiveLine, highlightActiveLineGutter,
  highlightSpecialChars, keymap, lineNumbers, rectangularSelection,
} from '@codemirror/view';
import { computed, effect, signal, type Signal } from '@preact/signals';
import { allDrafts, deleteDraft, putDraft, type Draft } from '../../shared/drafts';
import { loadSession, saveSession } from '../../shared/session';
import { on, onReconnect, RpcError } from '../../shared/socket';
import { baseName, isWithin, readFile, saveFile, type Change } from '../workspace/api';
import { languageFor } from './languages';
import { darkPlus } from './theme';

export type SaveStatus = 'saved' | 'modified' | 'saving' | 'conflict' | 'error';

// A tab owns its EditorState, so switching tabs keeps undo history and selection with no network work.
export type Tab = {
  id: number;
  path: string;
  state: EditorState;
  version: string;
  status: Signal<SaveStatus>;
  error: string;
  changeSeq: number;
  savedSeq: number;
  saving: boolean;
  saveTimer?: ReturnType<typeof setTimeout>;
  draftTimer?: ReturnType<typeof setTimeout>;
  scrollTop: number;
};

const AUTO_SAVE_DELAY = 750;
const DRAFT_DELAY = 300;

export const tabs = signal<Tab[]>([]);
export const activePath = signal<string | null>(null);
export const activeTab = computed(() => tabs.value.find((tab) => tab.path === activePath.value) ?? null);
export const cursor = signal({ line: 1, col: 1, selected: 0 });
export const autoSave = signal(loadSession().autoSave);
export const notice = signal('');

const remote = Annotation.define<boolean>();
const language = new Compartment();
let view: EditorView | null = null;
let nextTabId = 1;

const isDirty = (tab: Tab) => tab.changeSeq !== tab.savedSeq;
const find = (path: string) => tabs.value.find((tab) => tab.path === path);

const extensions = [
  lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(), foldGutter(), drawSelection(),
  dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(), bracketMatching(), closeBrackets(),
  rectangularSelection(), crosshairCursor(), highlightActiveLine(), highlightSelectionMatches(), search({ top: true }),
  indentUnit.of('  '), EditorState.tabSize.of(2), darkPlus,
  keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
  EditorView.updateListener.of((update) => {
    const tab = activeTab.peek();
    if (!tab) return;
    tab.state = update.state;
    if (update.selectionSet || update.docChanged) {
      const head = update.state.selection.main.head;
      const line = update.state.doc.lineAt(head);
      const selected = update.state.selection.ranges.reduce((sum, range) => sum + range.to - range.from, 0);
      cursor.value = { line: line.number, col: head - line.from + 1, selected };
    }
    if (update.docChanged && !update.transactions.some((tr) => tr.annotation(remote))) changed(tab);
  }),
];

export function createView(parent: HTMLElement) {
  view = new EditorView({ parent, state: EditorState.create({ extensions }) });
  const tab = activeTab.peek();
  if (tab) view.setState(tab.state);
  return view;
}

function newTab(path: string, content: string, version: string): Tab {
  const tab: Tab = {
    id: nextTabId++, path, version, state: EditorState.create({ doc: content, extensions: [extensions, language.of([])] }),
    status: signal('saved'), error: '', changeSeq: 0, savedSeq: 0, saving: false, scrollTop: 0,
  };
  const lang = languageFor(path);
  lang.load?.().then((support) => update(tab, { effects: language.reconfigure(support) }), () => {});
  return tab;
}

// Applies a transaction to a tab whether or not it is the one currently shown.
function update(tab: Tab, spec: TransactionSpec) {
  if (view && activeTab.peek() === tab) view.dispatch(spec);
  else tab.state = tab.state.update(spec).state;
}

function show(tab: Tab | null) {
  if (!view) return;
  const previous = tabs.peek().find((item) => item.state === view!.state);
  if (previous) previous.scrollTop = view.scrollDOM.scrollTop;
  view.setState(tab?.state ?? EditorState.create({ extensions }));
  if (!tab) return;
  const top = tab.scrollTop;
  view.requestMeasure({ read: () => {}, write: (_, v) => { v.scrollDOM.scrollTop = top; } });
  const head = tab.state.selection.main.head;
  const line = tab.state.doc.lineAt(head);
  cursor.value = { line: line.number, col: head - line.from + 1, selected: 0 };
  view.focus();
}

export function activate(path: string | null) {
  if (activePath.peek() === path) return;
  activePath.value = path;
  show(activeTab.peek());
}

// ---- Opening and closing ----------------------------------------------------------------

const opening = new Map<string, Promise<Tab | null>>();

async function load(path: string, draft?: Draft): Promise<Tab | null> {
  let doc;
  try {
    doc = await readFile(path);
  } catch (error) {
    if (!draft) { notice.value = `Cannot open ${path}: ${(error as Error).message}`; return null; }
    const tab = newTab(path, draft.content, draft.baseVersion);
    tab.changeSeq = 1;
    fail(tab, 'error', 'The file no longer exists on the server. Your unsaved text is kept here.');
    return tab;
  }
  if (!draft || draft.content === doc.content) {
    if (draft) void deleteDraft(path).catch(() => {});
    return newTab(path, doc.content, doc.version);
  }
  // Restore unsaved work from before a reload, crash, or discarded tab.
  const tab = newTab(path, draft.content, doc.version);
  tab.changeSeq = 1;
  if (draft.baseVersion !== doc.version) fail(tab, 'conflict', '');
  else { tab.status.value = 'modified'; if (autoSave.value) scheduleSave(tab); }
  return tab;
}

export async function openFile(path: string, line?: number) {
  let tab = find(path);
  if (!tab) {
    if (!opening.has(path)) opening.set(path, load(path).finally(() => opening.delete(path)));
    const loaded = await opening.get(path)!;
    if (!loaded) return;
    tab = find(path) ?? loaded;
    if (!find(path)) tabs.value = [...tabs.value, tab];
  }
  activate(path);
  if (line && view && activeTab.peek() === tab) {
    const target = tab.state.doc.line(Math.min(line, tab.state.doc.lines));
    view.dispatch({ selection: EditorSelection.cursor(target.from), effects: EditorView.scrollIntoView(target.from, { y: 'center' }) });
    view.focus();
  }
}

export function closeTab(path: string) {
  const tab = find(path);
  if (!tab) return;
  if (isDirty(tab)) {
    if (autoSave.value && tab.status.value !== 'conflict' && tab.status.value !== 'error') void save(tab);
    else if (confirm(`Discard unsaved changes to ${baseName(path)}?`)) void deleteDraft(path).catch(() => {});
    else return;
  }
  clearTimeout(tab.saveTimer);
  const index = tabs.value.indexOf(tab);
  tabs.value = tabs.value.filter((item) => item !== tab);
  if (activePath.peek() === path) activate(tabs.value[Math.min(index, tabs.value.length - 1)]?.path ?? null);
}

export function closeAll() {
  for (const tab of [...tabs.value]) closeTab(tab.path);
}

// ---- Saving -------------------------------------------------------------------------------

function changed(tab: Tab) {
  tab.changeSeq++;
  if (tab.status.value === 'saved' || tab.status.value === 'error') tab.status.value = 'modified';
  clearTimeout(tab.draftTimer);
  tab.draftTimer = setTimeout(() => writeDraft(tab), DRAFT_DELAY);
  if (autoSave.value && tab.status.value !== 'conflict') scheduleSave(tab);
}

function writeDraft(tab: Tab) {
  clearTimeout(tab.draftTimer);
  if (!isDirty(tab)) return;
  putDraft({ path: tab.path, content: tab.state.doc.toString(), baseVersion: tab.version })
    .catch(() => { notice.value = 'Browser storage is unavailable: unsaved changes will not survive a reload.'; });
}

function scheduleSave(tab: Tab) {
  clearTimeout(tab.saveTimer);
  tab.saveTimer = setTimeout(() => void save(tab), AUTO_SAVE_DELAY);
}

function fail(tab: Tab, status: 'conflict' | 'error', message: string) {
  tab.error = message;
  tab.status.value = status;
}

export async function save(tab: Tab) {
  clearTimeout(tab.saveTimer);
  if (tab.saving || !isDirty(tab) || tab.status.value === 'conflict') return;
  tab.saving = true;
  tab.status.value = 'saving';
  const seq = tab.changeSeq;
  try {
    // Waits in the socket queue while offline and is sent on reconnect.
    const result = await saveFile(tab.path, tab.state.doc.toString(), tab.version);
    tab.version = result.version;
    tab.savedSeq = seq;
    if (!isDirty(tab)) {
      clearTimeout(tab.draftTimer);
      tab.status.value = 'saved';
      void deleteDraft(tab.path).catch(() => {});
    } else tab.status.value = 'modified';
  } catch (error) {
    if (error instanceof RpcError && error.code === 'conflict') fail(tab, 'conflict', '');
    else fail(tab, 'error', (error as Error).message);
  } finally {
    tab.saving = false;
  }
  if (tab.status.value === 'modified' && autoSave.value) scheduleSave(tab);
}

export function saveAll() {
  for (const tab of tabs.value) void save(tab);
}

export function toggleAutoSave() {
  autoSave.value = !autoSave.value;
  saveSession({ autoSave: autoSave.value });
  if (autoSave.value) saveAll();
}

// Replaces a tab's text with the server copy as one undoable step, without marking it modified.
function replace(tab: Tab, content: string, version: string) {
  update(tab, { changes: { from: 0, to: tab.state.doc.length, insert: content }, annotations: remote.of(true) });
  tab.version = version;
  tab.savedSeq = tab.changeSeq;
  tab.error = '';
  tab.status.value = 'saved';
  void deleteDraft(tab.path).catch(() => {});
}

export async function keepMine(tab: Tab) {
  const server = await readFile(tab.path);
  tab.version = server.version;
  tab.status.value = 'modified';
  await save(tab);
}

export async function takeServer(tab: Tab) {
  const server = await readFile(tab.path);
  replace(tab, server.content, server.version);
}

// ---- Changes made elsewhere -------------------------------------------------------------

async function refreshClean(tab: Tab) {
  const server = await readFile(tab.path);
  if (server.version !== tab.version && !isDirty(tab) && !tab.saving) replace(tab, server.content, server.version);
}

export function applyRename(from: string, to: string) {
  let moved = false;
  for (const tab of tabs.value) {
    if (!isWithin(tab.path, from)) continue;
    const old = tab.path;
    tab.path = to + old.slice(from.length);
    moved = true;
    if (activePath.peek() === old) activePath.value = tab.path;
    if (isDirty(tab)) { void deleteDraft(old).catch(() => {}); writeDraft(tab); }
  }
  if (moved) tabs.value = [...tabs.value];
}

export function applyDelete(path: string) {
  for (const tab of tabs.value) {
    if (!isWithin(tab.path, path)) continue;
    if (isDirty(tab)) fail(tab, 'error', 'This file was deleted. Your unsaved text is kept here.');
    else closeTab(tab.path);
  }
}

on('files.saved', (change: Change) => {
  const tab = find(change.path);
  if (!tab || tab.version === change.version) return;
  if (isDirty(tab) || tab.saving) fail(tab, 'conflict', '');
  else void refreshClean(tab).catch(() => {});
});
on('files.renamed', (change: Change) => applyRename(change.oldPath!, change.path));
on('files.deleted', (change: Change) => applyDelete(change.path));
onReconnect(() => {
  for (const tab of tabs.value) if (!isDirty(tab)) void refreshClean(tab).catch(() => {});
});

// ---- Session ------------------------------------------------------------------------------

export async function restoreTabs() {
  const session = loadSession();
  let drafts: Draft[] = [];
  try { drafts = await allDrafts(); }
  catch { notice.value = 'Browser storage is unavailable: unsaved changes will not survive a reload.'; }
  const paths = [...new Set([...session.tabs, ...drafts.map((draft) => draft.path)])];
  const loaded = await Promise.all(paths.map((path) => load(path, drafts.find((draft) => draft.path === path))));
  tabs.value = loaded.filter((tab): tab is Tab => tab !== null);
  const active = find(session.active ?? '') ?? tabs.value[0] ?? null;
  activePath.value = null;
  activate(active?.path ?? null);
  effect(() => saveSession({ tabs: tabs.value.map((tab) => tab.path), active: activePath.value }));
}

// Persist drafts right away when the page is hidden, since it may be frozen or discarded next.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') for (const tab of tabs.peek()) writeDraft(tab);
});
