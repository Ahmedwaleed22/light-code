import { connection } from '../../shared/socket';
import { activeTab, autoSave, cursor, notice, toggleAutoSave } from '../editor/state';
import { languageFor } from '../editor/languages';

const statusText = { saved: 'Saved', modified: 'Unsaved', saving: 'Saving…', conflict: 'Conflict', error: 'Save failed' };

export function StatusBar() {
  const tab = activeTab.value;
  const state = connection.value;
  const where = cursor.value;
  return <footer class={`statusbar ${state}`}>
    <span class="status-item connection" title="Realtime connection to the server">
      <i class="dot" />{state === 'online' ? 'Connected' : state === 'connecting' ? 'Connecting…' : 'Reconnecting… edits are kept locally'}
    </span>
    {tab && <span class={`status-item save-${tab.status.value}`}>{statusText[tab.status.value]}</span>}
    {notice.value && <button class="status-item notice" title="Dismiss" onClick={() => { notice.value = ''; }}>{notice.value}</button>}
    <span class="spacer" />
    {tab && <>
      <span class="status-item">Ln {where.line}, Col {where.col}{where.selected ? ` (${where.selected} selected)` : ''}</span>
      <span class="status-item wide">Spaces: 2</span>
      <span class="status-item wide">UTF-8</span>
      <span class="status-item">{languageFor(tab.path).name}</span>
    </>}
    <button class="status-item" onClick={toggleAutoSave} title="Toggle auto save">Auto Save: {autoSave.value ? 'On' : 'Off'}</button>
  </footer>;
}
