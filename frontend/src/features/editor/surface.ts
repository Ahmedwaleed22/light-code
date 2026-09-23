import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Annotation, Compartment, EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state';
import {
  crosshairCursor, drawSelection, dropCursor, EditorView, highlightActiveLine, highlightActiveLineGutter,
  highlightSpecialChars, keymap, lineNumbers, rectangularSelection,
} from '@codemirror/view';
import { languageFor } from './languages';
import { darkPlus } from './theme';

type Cursor = { line: number; col: number; selected: number };
type EditorTab = { path: string; state: EditorState; scrollTop: number };

// Owns CodeMirror configuration and the one live view. Tabs keep their EditorState
// so a view switch only swaps state and never waits for the server.
export class EditorSurface<Tab extends EditorTab> {
  private readonly remote = Annotation.define<boolean>();
  private readonly language = new Compartment();
  private readonly extensions = [
    lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(), foldGutter(), drawSelection(),
    dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(), bracketMatching(), closeBrackets(),
    rectangularSelection(), crosshairCursor(), highlightActiveLine(), highlightSelectionMatches(), search({ top: true }),
    indentUnit.of('  '), EditorState.tabSize.of(2), darkPlus,
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
    EditorView.updateListener.of((update) => {
      const tab = this.activeTab();
      if (!tab) return;
      tab.state = update.state;
      if (update.selectionSet || update.docChanged) {
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        const selected = update.state.selection.ranges.reduce((sum, range) => sum + range.to - range.from, 0);
        this.onCursor({ line: line.number, col: head - line.from + 1, selected });
      }
      if (update.docChanged && !update.transactions.some((tr) => tr.annotation(this.remote))) this.onChanged(tab);
    }),
  ];
  private view: EditorView | null = null;

  constructor(
    private readonly activeTab: () => Tab | null,
    private readonly onChanged: (tab: Tab) => void,
    private readonly onCursor: (cursor: Cursor) => void,
  ) {}

  createView(parent: HTMLElement) {
    this.view = new EditorView({ parent, state: EditorState.create({ extensions: this.extensions }) });
    const tab = this.activeTab();
    if (tab) this.view.setState(tab.state);
    return this.view;
  }

  createState(content: string) {
    return EditorState.create({ doc: content, extensions: [this.extensions, this.language.of([])] });
  }

  configureLanguage(tab: Tab) {
    const lang = languageFor(tab.path);
    lang.load?.().then((support) => this.apply(tab, { effects: this.language.reconfigure(support) }), () => {});
  }

  // Applies a transaction whether the tab is visible or parked in the tab bar.
  apply(tab: Tab, spec: TransactionSpec) {
    if (this.view && this.activeTab() === tab) this.view.dispatch(spec);
    else tab.state = tab.state.update(spec).state;
  }

  show(tab: Tab | null, tabs: Tab[]) {
    if (!this.view) return;
    const previous = tabs.find((item) => item.state === this.view!.state);
    if (previous) previous.scrollTop = this.view.scrollDOM.scrollTop;
    this.view.setState(tab?.state ?? EditorState.create({ extensions: this.extensions }));
    if (!tab) return;
    const top = tab.scrollTop;
    this.view.requestMeasure({ read: () => {}, write: (_, view) => { view.scrollDOM.scrollTop = top; } });
    const head = tab.state.selection.main.head;
    const line = tab.state.doc.lineAt(head);
    this.onCursor({ line: line.number, col: head - line.from + 1, selected: 0 });
    this.view.focus();
  }

  scrollToLine(tab: Tab, line: number) {
    if (!this.view || this.activeTab() !== tab) return;
    const target = tab.state.doc.line(Math.min(line, tab.state.doc.lines));
    this.view.dispatch({ selection: EditorSelection.cursor(target.from), effects: EditorView.scrollIntoView(target.from, { y: 'center' }) });
    this.view.focus();
  }

  replaceContent(tab: Tab, content: string) {
    this.apply(tab, { changes: { from: 0, to: tab.state.doc.length, insert: content }, annotations: this.remote.of(true) });
  }
}
