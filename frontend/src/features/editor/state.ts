import { computed, signal, type Signal } from '@preact/signals';
import { createFile, listFiles, readFile, saveFile, type Entry } from './api';

export type Tab = { path: string; content: Signal<string>; savedContent: Signal<string>; version: string; saving: Signal<boolean> };
export const entries = signal<Entry[]>([]);
export const tabs = signal<Tab[]>([]);
export const activePath = signal<string | null>(null);
export const activeTab = computed(() => tabs.value.find((tab) => tab.path === activePath.value) ?? null);
export const message = signal('');

export async function refreshFiles() {
  try { entries.value = await listFiles(); }
  catch (error) { message.value = String(error); }
}
export async function openFile(path: string) {
  if (tabs.value.some((tab) => tab.path === path)) { activePath.value = path; return; }
  try {
    const doc = await readFile(path);
    tabs.value = [...tabs.value, { path, content: signal(doc.content), savedContent: signal(doc.content), version: doc.version, saving: signal(false) }];
    activePath.value = path;
    message.value = '';
  } catch (error) { message.value = String(error); }
}
export function closeTab(path: string) {
  const tab = tabs.value.find((item) => item.path === path);
  if (tab && tab.content.value !== tab.savedContent.value && !confirm(`Discard unsaved changes to ${path}?`)) return;
  const index = tabs.value.findIndex((item) => item.path === path);
  tabs.value = tabs.value.filter((item) => item.path !== path);
  if (activePath.value === path) activePath.value = tabs.value[Math.max(0, index - 1)]?.path ?? null;
}
export async function saveTab(tab: Tab) {
  if (tab.saving.value || tab.content.value === tab.savedContent.value) return;
  tab.saving.value = true;
  const content = tab.content.value;
  try {
    const doc = await saveFile({ path: tab.path, content, version: tab.version });
    tab.version = doc.version;
    tab.savedContent.value = content;
    message.value = `Saved ${tab.path}`;
  } catch (error) { message.value = `Could not save ${tab.path}: ${String(error)}`; }
  finally { tab.saving.value = false; }
}
export async function newFile() {
  const path = prompt('New file path (relative to workspace):');
  if (!path) return;
  try { await createFile(path); await refreshFiles(); await openFile(path); }
  catch (error) { message.value = String(error); }
}
