import { baseName } from '../workspace/api';
import { FileIcon } from '../layout/icons';
import { activate, activePath, closeTab, tabs, type Tab } from './state';

function TabItem({ tab }: { tab: Tab }) {
  const active = activePath.value === tab.path;
  const status = tab.status.value;
  const unsaved = status !== 'saved';
  return <div role="tab" aria-selected={active} title={tab.path}
    class={`tab${active ? ' active' : ''}${unsaved ? ' unsaved' : ''}${status === 'conflict' || status === 'error' ? ' problem' : ''}`}
    onMouseDown={(event) => { if (event.button === 0) activate(tab.path); }}
    onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); closeTab(tab.path); } }}>
    <FileIcon name={tab.path} />
    <span class="tab-label">{baseName(tab.path)}</span>
    <button class="tab-close" aria-label={`Close ${baseName(tab.path)}`} onMouseDown={(event) => event.stopPropagation()} onClick={() => closeTab(tab.path)} />
  </div>;
}

export function TabBar() {
  const tab = tabs.value.find((item) => item.path === activePath.value);
  return <div class="tabs-area">
    <div class="tabs" role="tablist">{tabs.value.map((item) => <TabItem key={item.id} tab={item} />)}</div>
    {tab && <div class="breadcrumbs">{tab.path.split('/').map((part, index, parts) =>
      <span key={index}>{part}{index < parts.length - 1 && <i class="crumb-sep">›</i>}</span>)}</div>}
  </div>;
}
