import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

// Colours follow VS Code's Dark+ theme.
const view = EditorView.theme({
  '&': { color: '#d4d4d4', backgroundColor: '#1e1e1e', height: '100%', fontSize: 'var(--editor-font-size)' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.5' },
  '.cm-content': { caretColor: '#aeafad', padding: '4px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#aeafad', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: '#264f78' },
  '.cm-activeLine': { backgroundColor: 'transparent', outline: '1px solid #282828' },
  '.cm-gutters': { backgroundColor: '#1e1e1e', color: '#858585', border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#c6c6c6' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 16px' },
  '.cm-foldGutter .cm-gutterElement': { color: '#c5c5c5', padding: '0 4px' },
  '.cm-selectionMatch': { backgroundColor: '#3a3d41' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: '#0064001a', outline: '1px solid #888' },
  '.cm-searchMatch': { backgroundColor: '#623315', outline: '1px solid #9e6a03' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#515c6a' },
  '.cm-panels': { backgroundColor: '#252526', color: '#ccc', borderColor: '#454545' },
  '.cm-panels input, .cm-panels button': { fontSize: '13px' },
  '.cm-tooltip': { backgroundColor: '#252526', border: '1px solid #454545', color: '#ccc' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#04395e' },
  '.cm-foldPlaceholder': { backgroundColor: 'transparent', border: 'none', color: '#888' },
}, { dark: true });

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.bool, t.null, t.atom, t.self], color: '#569cd6' },
  { tag: [t.controlKeyword, t.moduleKeyword], color: '#c586c0' },
  { tag: [t.string, t.special(t.string), t.character], color: '#ce9178' },
  { tag: [t.number, t.unit], color: '#b5cea8' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: '#6a9955' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#dcdcaa' },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: '#4ec9b0' },
  { tag: [t.variableName, t.propertyName, t.attributeName, t.labelName], color: '#9cdcfe' },
  { tag: [t.definition(t.variableName), t.constant(t.variableName)], color: '#4fc1ff' },
  { tag: [t.tagName, t.angleBracket], color: '#569cd6' },
  { tag: t.regexp, color: '#d16969' },
  { tag: t.escape, color: '#d7ba7d' },
  { tag: t.heading, color: '#569cd6', fontWeight: 'bold' },
  { tag: t.link, color: '#3794ff', textDecoration: 'underline' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.invalid, color: '#f44747' },
]);

export const darkPlus = [view, syntaxHighlighting(highlight)];
