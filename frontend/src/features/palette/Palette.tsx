import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { openFile } from '../editor/state';
import { FileIcon } from '../layout/icons';
import { baseName, parentOf } from '../workspace/api';
import { commands, files, palette, score } from './state';

const LIMIT = 60;

export function Palette() {
  const mode = palette.value?.mode;
  if (!mode) return null;
  return <PaletteBox key={mode} initial={mode === 'commands' ? '>' : ''} />;
}

function PaletteBox({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [paths, setPaths] = useState<string[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [enterQueued, setEnterQueued] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const isCommands = text.startsWith('>');
  const query = (isCommands ? text.replace(/^>+/, '') : text).trim();

  // Focus before paint so keys typed right after the shortcut land in the palette, not the editor.
  useLayoutEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { files().then(setPaths, () => setPaths([])); }, []);
  useEffect(() => { setCursor(0); }, [text]);
  useEffect(() => { list.current?.querySelector('.selected')?.scrollIntoView({ block: 'nearest' }); }, [cursor]);

  const items = useMemo(() => {
    if (isCommands) {
      return commands.value.map((command) => ({ command, rank: score(command.label, query) }))
        .filter((item) => item.rank > 0).sort((a, b) => b.rank - a.rank).map((item) => ({ key: item.command.id, command: item.command }));
    }
    const ranked: { path: string; rank: number }[] = [];
    for (const path of paths ?? []) {
      const rank = score(path, query);
      if (rank > 0) ranked.push({ path, rank });
    }
    ranked.sort((a, b) => b.rank - a.rank);
    return ranked.slice(0, LIMIT).map((item) => ({ key: item.path, path: item.path }));
  }, [isCommands, query, paths]);

  // Enter pressed before the index arrives opens the best match as soon as it does.
  useEffect(() => { if (enterQueued && paths !== null) { setEnterQueued(false); choose(0); } }, [enterQueued, paths]);

  const close = () => { palette.value = null; };
  function choose(index: number) {
    const item = items[index];
    if (!item) return;
    close();
    if ('command' in item) item.command!.run();
    else void openFile(item.path!);
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowDown') { event.preventDefault(); setCursor((cursor + 1) % Math.max(1, items.length)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor((cursor - 1 + items.length) % Math.max(1, items.length)); }
    else if (event.key === 'Enter') { event.preventDefault(); if (!isCommands && paths === null) setEnterQueued(true); else choose(cursor); }
  }

  return <div class="palette-backdrop" onPointerDown={close}>
    <div class="palette" role="dialog" aria-label="Command Palette" onPointerDown={(event) => event.stopPropagation()}>
      <input ref={input} value={text} spellcheck={false} placeholder="Search files by name (type > for commands)"
        onInput={(event) => setText(event.currentTarget.value)} onKeyDown={onKeyDown} />
      <div class="palette-list" ref={list} role="listbox">
        {!isCommands && paths === null && <div class="palette-empty">Indexing files…</div>}
        {items.length === 0 && (isCommands || paths !== null) && <div class="palette-empty">No matching results</div>}
        {items.map((item, index) => <div key={item.key} role="option" aria-selected={index === cursor}
          class={`palette-item${index === cursor ? ' selected' : ''}`} onMouseMove={() => setCursor(index)} onClick={() => choose(index)}>
          {'command' in item
            ? <><span>{item.command!.label}</span>{item.command!.keys && <kbd>{item.command!.keys}</kbd>}</>
            : <><FileIcon name={item.path!} /><span>{baseName(item.path!)}</span><small>{parentOf(item.path!)}</small></>}
        </div>)}
      </div>
    </div>
  </div>;
}
