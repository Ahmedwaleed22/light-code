import { activeTab, closeAll, closeTab, save, saveAll, toggleAutoSave } from '../editor/state';
import { collapseAll, refreshTree, startCreate } from '../explorer/state';
import { searchFocus, show, sidebarOpen, view } from '../layout/state';
import { commands, palette } from './state';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
export const mod = isMac ? '⌘' : 'Ctrl+';

export function registerCommands() {
  commands.value = [
    { id: 'file.new', label: 'File: New File', run: () => { show('explorer'); void startCreate('file'); } },
    { id: 'file.newFolder', label: 'File: New Folder', run: () => { show('explorer'); void startCreate('directory'); } },
    { id: 'file.save', label: 'File: Save', keys: `${mod}S`, run: () => { const tab = activeTab.value; if (tab) void save(tab); } },
    { id: 'file.saveAll', label: 'File: Save All', run: saveAll },
    { id: 'file.autoSave', label: 'File: Toggle Auto Save', run: toggleAutoSave },
    { id: 'editor.close', label: 'View: Close Editor', keys: 'Alt+W', run: () => { const tab = activeTab.value; if (tab) closeTab(tab.path); } },
    { id: 'editor.closeAll', label: 'View: Close All Editors', run: closeAll },
    { id: 'view.explorer', label: 'View: Show Explorer', keys: `${mod}Shift+E`, run: () => { view.value = 'explorer'; sidebarOpen.value = true; } },
    { id: 'view.search', label: 'View: Show Search', keys: `${mod}Shift+F`, run: () => { view.value = 'search'; sidebarOpen.value = true; searchFocus.value++; } },
    { id: 'view.sidebar', label: 'View: Toggle Sidebar', keys: `${mod}B`, run: () => { sidebarOpen.value = !sidebarOpen.value; } },
    { id: 'explorer.refresh', label: 'Explorer: Refresh', run: () => void refreshTree() },
    { id: 'explorer.collapse', label: 'Explorer: Collapse Folders', run: collapseAll },
    { id: 'go.file', label: 'Go to File…', keys: `${mod}P`, run: () => { palette.value = { mode: 'files' }; } },
  ];
}

export function runCommand(id: string) {
  commands.value.find((command) => command.id === id)?.run();
}

export function onGlobalKey(event: KeyboardEvent) {
  const primary = isMac ? event.metaKey : event.ctrlKey;
  const key = event.key.toLowerCase();
  let id: string | null = null;
  if (primary && !event.shiftKey && key === 's') id = 'file.save';
  else if (primary && event.shiftKey && key === 's') id = 'file.saveAll';
  else if (primary && event.shiftKey && key === 'p') { event.preventDefault(); palette.value = { mode: 'commands' }; return; }
  else if (primary && !event.shiftKey && key === 'p') id = 'go.file';
  else if (primary && !event.shiftKey && key === 'b') id = 'view.sidebar';
  else if (primary && event.shiftKey && key === 'e') id = 'view.explorer';
  else if (primary && event.shiftKey && key === 'f') id = 'view.search';
  else if (event.altKey && key === 'w') id = 'editor.close';
  else if (event.key === 'F1') { event.preventDefault(); palette.value = { mode: 'commands' }; return; }
  if (!id) return;
  event.preventDefault();
  event.stopPropagation();
  runCommand(id);
}
