import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

export type MenuItem = { label: string; action: () => void; danger?: boolean } | 'separator';
export const menu = signal<{ x: number; y: number; items: MenuItem[] } | null>(null);

export function openMenu(event: MouseEvent, items: MenuItem[]) {
  event.preventDefault();
  event.stopPropagation();
  menu.value = { x: Math.min(event.clientX, innerWidth - 220), y: Math.min(event.clientY, innerHeight - items.length * 26 - 12), items };
}

export function ContextMenu() {
  useEffect(() => {
    const close = () => { menu.value = null; };
    addEventListener('pointerdown', close);
    addEventListener('blur', close);
    addEventListener('keydown', close);
    return () => { removeEventListener('pointerdown', close); removeEventListener('blur', close); removeEventListener('keydown', close); };
  }, []);
  const current = menu.value;
  if (!current) return null;
  return <div class="context-menu" role="menu" style={{ left: current.x, top: current.y }} onPointerDown={(event) => event.stopPropagation()}>
    {current.items.map((item, index) => item === 'separator'
      ? <div key={index} class="menu-separator" />
      : <button key={index} role="menuitem" class={item.danger ? 'danger' : ''} onClick={() => { menu.value = null; item.action(); }}>{item.label}</button>)}
  </div>;
}
