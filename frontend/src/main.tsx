import { render } from 'preact';
import { App } from './app';
import { restoreTabs, watchEditorChanges } from './features/editor/state';
import { refreshTree, watchExplorerChanges } from './features/explorer/state';
import { watchLayoutWidth } from './features/layout/state';
import { registerCommands } from './features/palette/commands';
import { watchFileIndexChanges } from './features/palette/state';
import { startConnection } from './shared/socket';
import './style.css';

let stopWatching: (() => void) | null = null;
function watchWorkspace() {
  if (stopWatching) return;
  const stop = [watchEditorChanges(), watchExplorerChanges(), watchFileIndexChanges(), watchLayoutWidth()];
  stopWatching = () => stop.forEach((unsubscribe) => unsubscribe());
}
registerCommands();
watchWorkspace();
addEventListener('pagehide', () => { stopWatching?.(); stopWatching = null; });
addEventListener('pageshow', watchWorkspace);
startConnection();
render(<App />, document.getElementById('app')!);
void refreshTree();
void restoreTabs();
