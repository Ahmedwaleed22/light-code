import { saveTab, type Tab } from './state';

export function EditorToolbar({ tab }: { tab: Tab }) {
  const isDirty = tab.content.value !== tab.savedContent.value;
  return <div class="editor-toolbar"><span class="breadcrumb">{tab.path}</span><button onClick={() => void saveTab(tab)} disabled={tab.saving.value || !isDirty}>Save</button></div>;
}
