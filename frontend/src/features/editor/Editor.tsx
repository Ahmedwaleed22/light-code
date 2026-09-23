import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { saveTab, type Tab } from './state';

export function Editor({ tab }: { tab: Tab }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, [tab]);
  function onKeyDown(event: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault(); void saveTab(tab);
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      tab.content.value = tab.content.value.slice(0, start) + '  ' + tab.content.value.slice(end);
      requestAnimationFrame(() => { target.selectionStart = target.selectionEnd = start + 2; });
    }
  }
  return <textarea ref={ref} class="editor-input" aria-label={`Edit ${tab.path}`} spellcheck={false}
    value={tab.content} onInput={(event) => { tab.content.value = event.currentTarget.value; }} onKeyDown={onKeyDown} />;
}
