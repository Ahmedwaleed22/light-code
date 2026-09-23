import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { saveSession, loadSession } from './shared/session';
import { ConflictBar, Editor } from './features/editor/Editor';
import { TabBar } from './features/editor/TabBar';
import { activeTab, closeAll, closeTab, save, saveAll, tabs, toggleAutoSave } from './features/editor/state';
import { Explorer } from './features/explorer/Explorer';
import { collapseAll, refreshTree, startCreate } from './features/explorer/state';
import { ContextMenu } from './features/layout/ContextMenu';
import { FilesIcon, MenuIcon, SearchIcon } from './features/layout/icons';
import { StatusBar } from './features/layout/StatusBar';
import { Palette } from './features/palette/Palette';
import { commands, palette } from './features/palette/state';
import { SearchPanel } from './features/search/SearchPanel';

type View = 'explorer' | 'search';
const compactQuery = matchMedia('(max-width: 760px)');
const compact = signal(compactQuery.matches);
compactQuery.addEventListener('change', () => { compact.value = compactQuery.matches; });

// On narrow screens the sidebar starts closed and overlays the editor.
const view = signal<View>('explorer');
const sidebarOpen = signal(!compact.peek());
const sidebarWidth = signal(loadSession().sidebarWidth);
const searchFocus = signal(0);

function show(next: View) {
  if (view.value === next && sidebarOpen.value) { sidebarOpen.value = false; return; }
  view.value = next;
  sidebarOpen.value = true;
  if (next === 'search') searchFocus.value++;
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

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

function run(id: string) {
  commands.value.find((command) => command.id === id)?.run();
}

function onGlobalKey(event: KeyboardEvent) {
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
  run(id);
}

function Resizer() {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => { sidebarWidth.value = Math.max(170, Math.min(640, event.clientX - 48)); };
    const up = () => { setDragging(false); saveSession({ sidebarWidth: sidebarWidth.value }); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up, { once: true });
    return () => removeEventListener('pointermove', move);
  }, [dragging]);
  return <div class={`resizer${dragging ? ' dragging' : ''}`} onPointerDown={(event) => { event.preventDefault(); setDragging(true); }} />;
}

function Welcome() {
  return <div class="welcome">
    <div class="welcome-mark">{'</>'}</div>
    <h1>Light Code</h1>
    <dl class="shortcuts">
      <dt>Go to File</dt><dd><kbd>{mod}P</kbd></dd>
      <dt>Show All Commands</dt><dd><kbd>{mod}Shift+P</kbd></dd>
      <dt>Search in Files</dt><dd><kbd>{mod}Shift+F</kbd></dd>
      <dt>Toggle Sidebar</dt><dd><kbd>{mod}B</kbd></dd>
      <dt>New File</dt><dd><button class="link" onClick={() => run('file.new')}>Create</button></dd>
    </dl>
  </div>;
}

export function App() {
  useEffect(() => {
    addEventListener('keydown', onGlobalKey, true);
    return () => removeEventListener('keydown', onGlobalKey, true);
  }, []);
  const isCompact = compact.value;
  const open = sidebarOpen.value;
  const afterOpen = () => { if (compact.peek()) sidebarOpen.value = false; };
  return <div class={`shell${isCompact ? ' compact' : ''}`} style={{ '--sidebar-width': `${sidebarWidth.value}px` }}>
    <div class="main">
      <nav class="activitybar" aria-label="Views">
        <button class={view.value === 'explorer' && open ? 'active' : ''} title={`Explorer (${mod}Shift+E)`} onClick={() => show('explorer')}><FilesIcon /></button>
        <button class={view.value === 'search' && open ? 'active' : ''} title={`Search (${mod}Shift+F)`} onClick={() => show('search')}><SearchIcon /></button>
        <span class="spacer" />
        <button title={`Command Palette (${mod}Shift+P)`} onClick={() => { palette.value = { mode: 'commands' }; }}><MenuIcon size={22} /></button>
      </nav>
      {open && <aside class="sidebar">
        {view.value === 'explorer' ? <Explorer onOpen={afterOpen} rowHeight={isCompact ? 30 : 22} /> : <SearchPanel onOpen={afterOpen} focusKey={searchFocus.value} />}
        {!isCompact && <Resizer />}
      </aside>}
      {open && isCompact && <div class="scrim" onClick={() => { sidebarOpen.value = false; }} />}
      <section class="editor-group">
        <TabBar />
        <ConflictBar />
        <div class="editor-body">
          <Editor />
          {tabs.value.length === 0 && <Welcome />}
        </div>
      </section>
    </div>
    <StatusBar />
    <Palette />
    <ContextMenu />
  </div>;
}
