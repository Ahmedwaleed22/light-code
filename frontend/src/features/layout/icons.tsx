// Inline SVG icons (Codicon-style outlines) keep the bundle free of icon fonts.
type Props = { size?: number };
const svg = (path: string) => ({ size = 16 }: Props) =>
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={path} /></svg>;

export const FilesIcon = ({ size = 24 }: Props) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v13A1.5 1.5 0 0 0 7.5 19h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5M6 7H4.5A1.5 1.5 0 0 0 3 8.5v11A1.5 1.5 0 0 0 4.5 21H14a1.5 1.5 0 0 0 1.5-1.5V19" /></svg>;
export const SearchIcon = ({ size = 24 }: Props) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="14" cy="10" r="6" /><path d="M9.8 14.2 3.5 20.5" /></svg>;
export const GearIcon = ({ size = 24 }: Props) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></svg>;
export const NewFileIcon = svg('M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4.5M9.5 1.5 13 5v3M9.5 1.5V5H13M12 10v5M9.5 12.5h5');
export const NewFolderIcon = svg('M1.5 3.5a1 1 0 0 1 1-1h3.5l1.5 1.5h6a1 1 0 0 1 1 1V8M8.5 13.5h-6a1 1 0 0 1-1-1v-9M12 9.5v5M9.5 12h5');
export const RefreshIcon = svg('M13.5 8A5.5 5.5 0 1 1 11.8 4M12 1.5V4.5H9');
export const CollapseIcon = svg('M3 3.5h8.5v8.5M5.5 6h6M5.5 6v8.5H14V6z');
export const ChevronIcon = svg('M6 4l4 4-4 4');
export const MenuIcon = svg('M2 4h12M2 8h12M2 12h12');

const colors: Record<string, string> = {
  ts: '#3178c6', tsx: '#3178c6', js: '#f1dd35', jsx: '#f1dd35', mjs: '#f1dd35', json: '#cbcb41', go: '#00add8', py: '#3572a5',
  rs: '#dea584', md: '#519aba', css: '#563d7c', html: '#e34c26', yml: '#cb171e', yaml: '#cb171e', sh: '#89e051', txt: '#9aa0a6',
};

export function FileIcon({ name }: { name: string }) {
  const base = name.slice(name.lastIndexOf('/') + 1).toLowerCase();
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : '';
  const label = ext === 'json' ? '{}' : ext === 'md' ? 'M↓' : (ext || '•').slice(0, 2).toUpperCase();
  return <span class="file-icon" style={{ color: colors[ext] ?? '#9aa0a6' }} aria-hidden="true">{label}</span>;
}
