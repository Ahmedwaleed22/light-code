import { activePath, closeTab, tabs, type Tab } from './state';

function TabButton({ tab }: { tab: Tab }) {
  const isActive = activePath.value === tab.path;
  const dirty = tab.content.value !== tab.savedContent.value;
  return <div class={`tab ${isActive ? 'active' : ''}`}>
    <button role="tab" aria-selected={isActive} onClick={() => { activePath.value = tab.path; }}>{tab.path.split('/').pop()}{dirty ? ' ●' : ''}</button>
    <button class="tab-close" aria-label={`Close ${tab.path}`} onClick={() => closeTab(tab.path)}>×</button>
  </div>;
}
export function TabBar() {
  return <div class="tabs" role="tablist">{tabs.value.map((tab) => <TabButton key={tab.path} tab={tab} />)}</div>;
}
