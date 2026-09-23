// Small UI preferences restored on load. Document text lives in drafts, not here.

export type Session = { tabs: string[]; active: string | null; expanded: string[]; sidebarWidth: number; autoSave: boolean };

const KEY = 'light-code:session';
const defaults: Session = { tabs: [], active: null, expanded: [], sidebarWidth: 260, autoSave: true };

export function loadSession(): Session {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; }
  catch { return { ...defaults }; }
}

export function saveSession(patch: Partial<Session>) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...loadSession(), ...patch })); }
  catch { /* Storage full or disabled: the session simply is not restored. */ }
}
