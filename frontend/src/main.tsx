import { render } from 'preact';
import { App } from './app';
import { restoreTabs } from './features/editor/state';
import { refreshTree } from './features/explorer/state';
import { startConnection } from './shared/socket';
import './style.css';

startConnection();
render(<App />, document.getElementById('app')!);
void refreshTree();
void restoreTabs();
