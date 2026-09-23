import { useEffect } from 'preact/hooks';
import { Editor } from './features/editor/Editor';
import { EditorToolbar } from './features/editor/EditorToolbar';
import { TabBar } from './features/editor/TabBar';
import { activePath, activeTab, entries, message, newFile, openFile, refreshFiles } from './features/editor/state';

export function App() {
  useEffect(() => { void refreshFiles(); }, []);
  return <div class="shell">
    <header class="topbar"><div class="brand"><span class="brand-mark">⌘</span><span>SwiftEdit</span></div><span class="topbar-label">WORKSPACE</span><button class="top-action" onClick={() => void newFile()}>+ New file</button></header>
    <div class="workspace">
      <aside class="sidebar" aria-label="Files"><div class="sidebar-heading"><span>EXPLORER</span><button title="Refresh files" onClick={() => void refreshFiles()}>↻</button></div><div class="file-list">
        {entries.value.length === 0 && <p class="empty-list">No files yet. Create one to begin.</p>}
        {entries.value.map((entry) => <button key={entry.path} class={`file-row ${entry.kind === 'directory' ? 'directory' : ''} ${activePath.value === entry.path ? 'selected' : ''}`}
          style={{ paddingLeft: `${12 + (entry.path.split('/').length - 1) * 14}px` }} disabled={entry.kind === 'directory'} onClick={() => void openFile(entry.path)} title={entry.path}>
          <span class="file-icon">{entry.kind === 'directory' ? '▸' : '≡'}</span><span class="file-name">{entry.name}</span></button>)}
      </div></aside>
      <section class="editor-pane" aria-label="Editor"><TabBar />
      {activeTab.value ? <><EditorToolbar tab={activeTab.value} /><Editor key={activeTab.value.path} tab={activeTab.value} /></> : <div class="welcome"><div class="welcome-icon">⌘</div><h1>Ready when you are.</h1><p>Choose a file from the explorer or create a new one.</p><button onClick={() => void newFile()}>Create a file</button></div>}
      </section>
    </div><footer class="statusbar"><span>{message.value || 'Ready'}</span><span>UTF-8 · Ctrl/Cmd+S to save</span></footer>
  </div>;
}
