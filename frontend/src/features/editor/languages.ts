import type { Extension } from '@codemirror/state';

// Language packs are code-split and fetched the first time a matching file opens.
type Language = { name: string; load?: () => Promise<Extension> };

const js = (options: { jsx?: boolean; typescript?: boolean }) => () => import('@codemirror/lang-javascript').then((m) => m.javascript(options));

const byExtension: Record<string, Language> = {
  js: { name: 'JavaScript', load: js({}) },
  mjs: { name: 'JavaScript', load: js({}) },
  cjs: { name: 'JavaScript', load: js({}) },
  jsx: { name: 'JavaScript JSX', load: js({ jsx: true }) },
  ts: { name: 'TypeScript', load: js({ typescript: true }) },
  mts: { name: 'TypeScript', load: js({ typescript: true }) },
  tsx: { name: 'TypeScript JSX', load: js({ jsx: true, typescript: true }) },
  json: { name: 'JSON', load: () => import('@codemirror/lang-json').then((m) => m.json()) },
  css: { name: 'CSS', load: () => import('@codemirror/lang-css').then((m) => m.css()) },
  html: { name: 'HTML', load: () => import('@codemirror/lang-html').then((m) => m.html()) },
  htm: { name: 'HTML', load: () => import('@codemirror/lang-html').then((m) => m.html()) },
  md: { name: 'Markdown', load: () => import('@codemirror/lang-markdown').then((m) => m.markdown()) },
  py: { name: 'Python', load: () => import('@codemirror/lang-python').then((m) => m.python()) },
  go: { name: 'Go', load: () => import('@codemirror/lang-go').then((m) => m.go()) },
  rs: { name: 'Rust', load: () => import('@codemirror/lang-rust').then((m) => m.rust()) },
  yml: { name: 'YAML', load: () => import('@codemirror/lang-yaml').then((m) => m.yaml()) },
  yaml: { name: 'YAML', load: () => import('@codemirror/lang-yaml').then((m) => m.yaml()) },
};

export function languageFor(path: string): Language {
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  return byExtension[extension] ?? { name: 'Plain Text' };
}
