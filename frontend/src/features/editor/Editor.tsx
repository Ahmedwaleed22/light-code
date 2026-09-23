import { useEffect, useRef } from 'preact/hooks';
import { activeTab, createView, keepMine, takeServer } from './state';

// A single CodeMirror view is created once; tabs swap their state into it.
export function Editor() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const view = createView(host.current!);
    return () => view.destroy();
  }, []);
  return <div class="editor-host" ref={host} />;
}

export function ConflictBar() {
  const tab = activeTab.value;
  if (!tab) return null;
  const status = tab.status.value;
  if (status === 'conflict') {
    return <div class="notice-bar warning" role="alert">
      <span>This file changed on the server since you began editing.</span>
      <button onClick={() => void takeServer(tab)}>Use Server Version</button>
      <button onClick={() => void keepMine(tab)}>Overwrite with Mine</button>
    </div>;
  }
  if (status === 'error' && tab.error) return <div class="notice-bar error" role="alert"><span>{tab.error}</span></div>;
  return null;
}
