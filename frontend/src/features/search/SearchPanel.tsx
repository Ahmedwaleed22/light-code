import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { openFile } from '../editor/state';
import { FileIcon } from '../layout/icons';
import { baseName, parentOf, searchText, type Match } from '../workspace/api';

const query = signal('');
const results = signal<{ matches: Match[]; truncated: boolean } | null>(null);
const searching = signal(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let current: AbortController | null = null;

function cancelSearch() {
  generation++;
  clearTimeout(timer);
  current?.abort();
  current = null;
  searching.value = false;
}

function run(value: string) {
  cancelSearch();
  query.value = value;
  results.value = null;
  if (value.trim().length < 2) return;
  const id = generation;
  timer = setTimeout(async () => {
    const controller = new AbortController();
    current = controller;
    searching.value = true;
    try {
      const found = await searchText(value, controller.signal);
      if (id === generation) results.value = found;
    } catch {
      if (id === generation) results.value = null;
    } finally {
      if (id === generation) { searching.value = false; current = null; }
    }
  }, 250);
}

function highlight(text: string, needle: string) {
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return text;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + needle.length)}</mark>{text.slice(at + needle.length)}</>;
}

export function SearchPanel({ onOpen, focusKey }: { onOpen: () => void; focusKey: number }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, [focusKey]);
  useEffect(() => { run(query.peek()); return cancelSearch; }, []);
  const found = results.value;
  const groups = new Map<string, Match[]>();
  for (const match of found?.matches ?? []) groups.set(match.path, [...(groups.get(match.path) ?? []), match]);
  return <section class="sidebar-view" aria-label="Search">
    <header class="sidebar-title"><span>Search</span></header>
    <div class="search-box">
      <input ref={input} value={query.value} placeholder="Search" spellcheck={false} onInput={(event) => run(event.currentTarget.value)} />
    </div>
    <div class="search-summary">{searching.value ? 'Searching…' : found && `${found.matches.length}${found.truncated ? '+' : ''} results in ${groups.size} files`}</div>
    <div class="search-results">
      {[...groups].map(([path, matches]) => <div key={path} class="search-group">
        <div class="search-file" title={path}><FileIcon name={path} /><span>{baseName(path)}</span><small>{parentOf(path)}</small><em>{matches.length}</em></div>
        {matches.map((match) => <button key={match.line} class="search-line" onClick={() => { void openFile(match.path, match.line); onOpen(); }}>
          {highlight(match.text, query.value)}
        </button>)}
      </div>)}
    </div>
  </section>;
}
