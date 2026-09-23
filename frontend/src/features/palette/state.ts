import { signal } from '@preact/signals';
import { on } from '../../shared/socket';
import { fileIndex } from '../workspace/api';

export type Command = { id: string; label: string; keys?: string; run: () => void };

export const palette = signal<{ mode: 'files' | 'commands' } | null>(null);
export const commands = signal<Command[]>([]);

// The file index is fetched once and filtered locally, so every keystroke is instant.
let index: Promise<string[]> | null = null;
export function files() {
  index ??= fileIndex().then((result) => result.paths, (error) => { index = null; throw error; });
  return index;
}
const invalidate = () => { index = null; };
on('files.created', invalidate);
on('files.deleted', invalidate);
on('files.renamed', invalidate);

// Subsequence match favouring consecutive characters and the file name over the directory.
export function score(path: string, query: string): number {
  if (!query) return 1;
  const text = path.toLowerCase();
  const nameStart = text.lastIndexOf('/') + 1;
  let total = 0;
  let from = 0;
  let previous = -2;
  for (const ch of query.toLowerCase()) {
    if (ch === ' ') continue;
    const at = text.indexOf(ch, from);
    if (at < 0) return 0;
    total += 1 + (at === previous + 1 ? 5 : 0) + (at >= nameStart ? 3 : 0) + (at === nameStart ? 6 : 0);
    previous = at;
    from = at + 1;
  }
  return total - path.length * 0.01;
}
