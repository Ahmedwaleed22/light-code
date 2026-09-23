import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { activePath, openFile } from '../editor/state';
import { openMenu } from '../layout/ContextMenu';
import { ChevronIcon, CollapseIcon, FileIcon, NewFileIcon, NewFolderIcon, RefreshIcon } from '../layout/icons';
import { baseName, type Entry } from '../workspace/api';
import { collapseAll, commitEdit, editing, expanded, refreshTree, remove, rows, selected, setExpanded, startCreate, startRename } from './state';

const OVERSCAN = 12;

function NameInput({ initial, depth, kind, height }: { initial: string; depth: number; kind: Entry['kind']; height: number }) {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const el = input.current!;
    el.focus();
    const dot = kind === 'file' ? initial.lastIndexOf('.') : -1;
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, []);
  let done = false;
  const finish = (commit: boolean) => {
    if (done) return;
    done = true;
    if (commit) void commitEdit(input.current!.value); else editing.value = null;
  };
  return <div class="tree-row editing" style={{ paddingLeft: 8 + depth * 12, height }}>
    <span class="twistie" />{kind === 'file' ? <FileIcon name={initial || 'x'} /> : <span class="folder-glyph" />}
    <input ref={input} class="tree-input" value={initial} spellcheck={false} aria-label="Name"
      onKeyDown={(event) => { if (event.key === 'Enter') finish(true); if (event.key === 'Escape') finish(false); }}
      onBlur={() => finish(true)} />
  </div>;
}

function entryMenu(event: MouseEvent, entry: Entry | null) {
  const dir = entry ? (entry.kind === 'directory' ? entry.path : undefined) : '';
  openMenu(event, [
    { label: 'New File…', action: () => void startCreate('file', dir) },
    { label: 'New Folder…', action: () => void startCreate('directory', dir) },
    ...(entry ? ['separator' as const,
      { label: 'Copy Path', action: () => void navigator.clipboard?.writeText(entry.path) },
      { label: 'Rename…', action: () => startRename(entry.path) },
      { label: 'Delete', action: () => void remove(entry.path), danger: true }] : []),
  ]);
}

function activateEntry(entry: Entry, onOpen: () => void) {
  selected.value = entry.path;
  if (entry.kind === 'directory') void setExpanded(entry.path, !expanded.value.has(entry.path));
  else { void openFile(entry.path); onOpen(); }
}

export function Explorer({ onOpen, rowHeight }: { onOpen: () => void; rowHeight: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 600 });
  useEffect(() => {
    const el = scroller.current!;
    const measure = () => setViewport({ top: el.scrollTop, height: el.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const all = rows.value;
  const first = Math.max(0, Math.floor(viewport.top / rowHeight) - OVERSCAN);
  const last = Math.min(all.length, Math.ceil((viewport.top + viewport.height) / rowHeight) + OVERSCAN);
  const edit = editing.value;

  function onKeyDown(event: KeyboardEvent) {
    const path = selected.value;
    if (!path || edit || (event.target as HTMLElement).tagName === 'INPUT') return;
    if (event.key === 'F2') { event.preventDefault(); startRename(path); }
    if (event.key === 'Delete') { event.preventDefault(); void remove(path); }
  }

  return <section class="sidebar-view" aria-label="Explorer" onKeyDown={onKeyDown}>
    <header class="sidebar-title"><span>Explorer</span>
      <div class="sidebar-actions">
        <button title="New File" onClick={() => void startCreate('file')}><NewFileIcon /></button>
        <button title="New Folder" onClick={() => void startCreate('directory')}><NewFolderIcon /></button>
        <button title="Refresh Explorer" onClick={() => void refreshTree()}><RefreshIcon /></button>
        <button title="Collapse Folders" onClick={collapseAll}><CollapseIcon /></button>
      </div>
    </header>
    <div class="tree" role="tree" ref={scroller} onScroll={(event) => setViewport({ top: event.currentTarget.scrollTop, height: event.currentTarget.clientHeight })}
      onContextMenu={(event) => entryMenu(event, null)} onClick={(event) => { if (event.target === event.currentTarget) selected.value = null; }}>
      <div style={{ height: all.length * rowHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${first * rowHeight}px)` }}>
          {all.slice(first, last).map((row) => {
            if (row.type === 'input') return <NameInput key="new" initial="" depth={row.depth} kind={edit?.mode === 'create' ? edit.kind : 'file'} height={rowHeight} />;
            const { entry, depth } = row;
            if (edit?.mode === 'rename' && edit.path === entry.path) return <NameInput key={entry.path} initial={entry.name} depth={depth} kind={entry.kind} height={rowHeight} />;
            const open = entry.kind === 'directory' && expanded.value.has(entry.path);
            return <button key={entry.path} role="treeitem" aria-expanded={entry.kind === 'directory' ? open : undefined} title={entry.path}
              class={`tree-row${selected.value === entry.path ? ' selected' : ''}${activePath.value === entry.path ? ' active' : ''}`}
              style={{ paddingLeft: 8 + depth * 12, height: rowHeight }} onClick={() => activateEntry(entry, onOpen)} onContextMenu={(event) => { selected.value = entry.path; entryMenu(event, entry); }}>
              <span class={`twistie${open ? ' open' : ''}`}>{entry.kind === 'directory' && <ChevronIcon />}</span>
              {entry.kind === 'file' && <FileIcon name={entry.name} />}
              <span class="tree-label">{baseName(entry.path)}</span>
            </button>;
          })}
        </div>
      </div>
      {all.length === 0 && !edit && <p class="tree-empty">The workspace is empty. <button class="link" onClick={() => void startCreate('file', '')}>Create a file</button></p>}
    </div>
  </section>;
}
