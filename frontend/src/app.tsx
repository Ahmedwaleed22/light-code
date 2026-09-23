import { useEffect, useState } from 'preact/hooks';
import { ConflictBar, Editor } from './features/editor/Editor';
import { TabBar } from './features/editor/TabBar';
import { tabs } from './features/editor/state';
import { Explorer } from './features/explorer/Explorer';
import { ContextMenu } from './features/layout/ContextMenu';
import { FilesIcon, MenuIcon, SearchIcon } from './features/layout/icons';
import { compact, persistSidebarWidth, resizeSidebar, searchFocus, show, sidebarOpen, sidebarWidth, view } from './features/layout/state';
import { StatusBar } from './features/layout/StatusBar';
import { Palette } from './features/palette/Palette';
import { mod, onGlobalKey, runCommand } from './features/palette/commands';
import { palette } from './features/palette/state';
import { SearchPanel } from './features/search/SearchPanel';

function Resizer() {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => resizeSidebar(event.clientX);
    const up = () => { setDragging(false); persistSidebarWidth(); };
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
      <dt>New File</dt><dd><button class="link" onClick={() => runCommand('file.new')}>Create</button></dd>
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
