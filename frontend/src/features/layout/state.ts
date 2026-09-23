import { signal } from '@preact/signals';
import { loadSession, saveSession } from '../../shared/session';

type View = 'explorer' | 'search';
const compactQuery = matchMedia('(max-width: 760px)');
export const compact = signal(compactQuery.matches);

// On narrow screens the sidebar starts closed and overlays the editor.
export const view = signal<View>('explorer');
export const sidebarOpen = signal(!compact.peek());
export const sidebarWidth = signal(loadSession().sidebarWidth);
export const searchFocus = signal(0);

export function watchLayoutWidth() {
  const update = () => { compact.value = compactQuery.matches; };
  compactQuery.addEventListener('change', update);
  return () => compactQuery.removeEventListener('change', update);
}

export function show(next: View) {
  if (view.value === next && sidebarOpen.value) { sidebarOpen.value = false; return; }
  view.value = next;
  sidebarOpen.value = true;
  if (next === 'search') searchFocus.value++;
}

export function resizeSidebar(clientX: number) {
  sidebarWidth.value = Math.max(170, Math.min(640, clientX - 48));
}

export function persistSidebarWidth() {
  saveSession({ sidebarWidth: sidebarWidth.value });
}
