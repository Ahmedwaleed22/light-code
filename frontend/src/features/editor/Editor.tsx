import type { JSX } from 'preact';
import {
  useEffect,
  useRef
} from 'preact/hooks';

import {
  saveTab,
  type Tab
} from './state';

type LineDirection =
  | 'up'
  | 'down';

function getLineStart(
  text: string,
  position: number
) {
  const index =
    text.lastIndexOf(
      '\n',
      Math.max(0, position - 1)
    );

  return index === -1
    ? 0
    : index + 1;
}

function getLineEnd(
  text: string,
  position: number
) {
  const index =
    text.indexOf(
      '\n',
      position
    );

  return index === -1
    ? text.length
    : index;
}

export function Editor({
  tab
}: {
  tab: Tab;
}) {
  const ref =
    useRef<HTMLTextAreaElement>(null);

  const historyRef =
    useRef<string[]>([]);

  const futureRef =
    useRef<string[]>([]);

  const lastContentRef =
    useRef(tab.content.value);

  useEffect(() => {
    ref.current?.focus();

    historyRef.current = [];
    futureRef.current = [];

    lastContentRef.current =
      tab.content.value;
  }, [tab]);

  function pushHistory(
    value: string
  ) {
    const current =
      tab.content.value;

    if (value === current) {
      return;
    }

    historyRef.current = [
      ...historyRef.current.slice(-99),
      current
    ];

    futureRef.current = [];

    tab.content.value =
      value;

    lastContentRef.current =
      value;
  }

  function undo() {
    const textarea =
      ref.current;

    if (!textarea) {
      return;
    }

    const history =
      historyRef.current;

    if (history.length === 0) {
      return;
    }

    const previous =
      history[history.length - 1];

    historyRef.current =
      history.slice(
        0,
        -1
      );

    futureRef.current = [
      ...futureRef.current,
      tab.content.value
    ];

    tab.content.value =
      previous;

    lastContentRef.current =
      previous;

    requestAnimationFrame(() => {
      textarea.focus();

      const position =
        Math.min(
          textarea.selectionStart,
          previous.length
        );

      textarea.selectionStart =
        position;

      textarea.selectionEnd =
        position;
    });
  }

  function redo() {
    const textarea =
      ref.current;

    if (!textarea) {
      return;
    }

    const future =
      futureRef.current;

    if (future.length === 0) {
      return;
    }

    const next =
      future[future.length - 1];

    futureRef.current =
      future.slice(0, -1);

    historyRef.current = [
      ...historyRef.current,
      tab.content.value
    ];

    tab.content.value =
      next;

    lastContentRef.current =
      next;

    requestAnimationFrame(() => {
      textarea.focus();

      const position =
        Math.min(
          textarea.selectionStart,
          next.length
        );

      textarea.selectionStart =
        position;

      textarea.selectionEnd =
        position;
    });
  }

  function replaceSelection(
    replacement: string
  ) {
    const textarea =
      ref.current;

    if (!textarea) {
      return;
    }

    const start =
      textarea.selectionStart;

    const end =
      textarea.selectionEnd;

    const current =
      tab.content.value;

    const next =
      current.slice(0, start) +
      replacement +
      current.slice(end);

    pushHistory(next);

    requestAnimationFrame(() => {
      textarea.focus();

      const cursor =
        start +
        replacement.length;

      textarea.selectionStart =
        cursor;

      textarea.selectionEnd =
        cursor;
    });
  }

  function cutSelection() {
    const textarea =
      ref.current;

    if (!textarea) {
      return;
    }

    const start =
      textarea.selectionStart;

    const end =
      textarea.selectionEnd;

    if (start === end) {
      return;
    }

    const selected =
      tab.content.value.slice(
        start,
        end
      );

    void navigator.clipboard
      ?.writeText(selected)
      .catch(() => {});

    replaceSelection('');
  }

  async function copySelection() {
    const textarea =
      ref.current;

    if (!textarea) {
      return;
    }

    const start =
      textarea.selectionStart;

    const end =
      textarea.selectionEnd;

    if (start === end) {
      return;
    }

    const selected =
      tab.content.value.slice(
        start,
        end
      );

    try {
      await navigator.clipboard.writeText(
        selected
      );
    } catch {
      try {
        textarea.focus();

        document.execCommand(
          'copy'
        );
      } catch {
        // Ignore clipboard errors.
      }
    }
  }

  async function pasteText() {
    try {
      const text =
        await navigator.clipboard.readText();

      if (text) {
        replaceSelection(text);
      }
    } catch {
      ref.current?.focus();

      try {
        document.execCommand(
          'paste'
        );
      } catch {
        // Browser may block programmatic paste.
      }
    }
  }

  function selectAll() {
    const textarea =
      ref.current;

    if (!textarea) {
      return;
    }

    textarea.focus();

    textarea.selectionStart = 0;
    textarea.selectionEnd =
      tab.content.value.length;
  }

  function expandSelection() {
    const textarea =
      ref.current;

    if (!textarea) {
      return;
    }

    const text =
      tab.content.value;

    const start =
      textarea.selectionStart;

    const end =
      textarea.selectionEnd;

    const selectionStart =
      getLineStart(
        text,
        start
      );

    const selectionEnd =
      getLineEnd(
        text,
        end
      );

    textarea.focus();

    textarea.selectionStart =
      selectionStart;

    textarea.selectionEnd =
      selectionEnd;
  }

  function copyLine(
    direction: LineDirection
  ) {
    const textarea =
      ref.current;

    if (!textarea) {
      return;
    }

    const text =
      tab.content.value;

    const selectionStart =
      textarea.selectionStart;

    const selectionEnd =
      textarea.selectionEnd;

    const lineStart =
      getLineStart(
        text,
        selectionStart
      );

    let lineEnd =
      getLineEnd(
        text,
        selectionEnd
      );

    if (
      lineEnd < text.length
    ) {
      lineEnd += 1;
    }

    const line =
      text.slice(
        lineStart,
        lineEnd
      );

    const insertAt =
      direction === 'up'
        ? lineStart
        : lineEnd;

    const next =
      text.slice(0, insertAt) +
      line +
      text.slice(insertAt);

    pushHistory(next);

    requestAnimationFrame(() => {
      textarea.focus();

      if (
        direction === 'up'
      ) {
        textarea.selectionStart =
          selectionStart +
          line.length;

        textarea.selectionEnd =
          selectionEnd +
          line.length;
      } else {
        textarea.selectionStart =
          selectionStart +
          line.length;

        textarea.selectionEnd =
          selectionEnd +
          line.length;
      }
    });
  }

  function moveLine(
    direction: LineDirection
  ) {
    const textarea =
      ref.current;

    if (!textarea) {
      return;
    }

    const text =
      tab.content.value;

    const selectionStart =
      textarea.selectionStart;

    const selectionEnd =
      textarea.selectionEnd;

    const currentLineStart =
      getLineStart(
        text,
        selectionStart
      );

    let currentLineEnd =
      getLineEnd(
        text,
        selectionEnd
      );

    if (
      currentLineEnd <
      text.length
    ) {
      currentLineEnd += 1;
    }

    const selectedBlock =
      text.slice(
        currentLineStart,
        currentLineEnd
      );

    if (
      direction === 'up'
    ) {
      if (
        currentLineStart === 0
      ) {
        return;
      }

      let previousLineStart =
        currentLineStart - 1;

      if (
        previousLineStart > 0
      ) {
        const previousNewline =
          text.lastIndexOf(
            '\n',
            previousLineStart - 1
          );

        previousLineStart =
          previousNewline === -1
            ? 0
            : previousNewline + 1;
      }

      const previousLine =
        text.slice(
          previousLineStart,
          currentLineStart
        );

      const next =
        text.slice(
          0,
          previousLineStart
        ) +
        selectedBlock +
        previousLine +
        text.slice(
          currentLineEnd
        );

      pushHistory(next);

      const offset =
        selectionStart -
        currentLineStart;

      const selectedLength =
        Math.max(
          0,
          selectionEnd -
            selectionStart
        );

      requestAnimationFrame(() => {
        textarea.focus();

        textarea.selectionStart =
          previousLineStart +
          offset;

        textarea.selectionEnd =
          previousLineStart +
          offset +
          selectedLength;
      });

      return;
    }

    if (
      currentLineEnd >=
      text.length
    ) {
      return;
    }

    const nextLineEnd =
      getLineEnd(
        text,
        currentLineEnd
      ) + 1;

    const nextLine =
      text.slice(
        currentLineEnd,
        nextLineEnd
      );

    const next =
      text.slice(
        0,
        currentLineStart
      ) +
      nextLine +
      selectedBlock +
      text.slice(
        nextLineEnd
      );

    pushHistory(next);

    const offset =
      selectionStart -
      currentLineStart;

    const selectedLength =
      Math.max(
        0,
        selectionEnd -
          selectionStart
      );

    requestAnimationFrame(() => {
      textarea.focus();

      textarea.selectionStart =
        currentLineStart +
        nextLine.length +
        offset;

      textarea.selectionEnd =
        currentLineStart +
        nextLine.length +
        offset +
        selectedLength;
    });
  }

  function onKeyDown(
    event: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>
  ) {
    const key =
      event.key.toLowerCase();

    if (
      (event.ctrlKey ||
        event.metaKey) &&
      key === 's'
    ) {
      event.preventDefault();

      if (event.shiftKey) {
        window.dispatchEvent(
          new CustomEvent(
            'swiftedit-save-as'
          )
        );
      } else {
        void saveTab(tab);
      }

      return;
    }

    if (
      (event.ctrlKey ||
        event.metaKey) &&
      key === 'z'
    ) {
      event.preventDefault();

      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }

      return;
    }

    if (
      (event.ctrlKey ||
        event.metaKey) &&
      key === 'y'
    ) {
      event.preventDefault();
      redo();
      return;
    }

    if (
      (event.ctrlKey ||
        event.metaKey) &&
      key === 'a'
    ) {
      event.preventDefault();
      selectAll();
      return;
    }

    if (
      (event.ctrlKey ||
        event.metaKey) &&
      key === 'c'
    ) {
      event.preventDefault();
      void copySelection();
      return;
    }

    if (
      (event.ctrlKey ||
        event.metaKey) &&
      key === 'x'
    ) {
      event.preventDefault();
      cutSelection();
      return;
    }

    if (
      (event.ctrlKey ||
        event.metaKey) &&
      key === 'v'
    ) {
      event.preventDefault();
      void pasteText();
      return;
    }

    if (
      event.key === 'Tab'
    ) {
      event.preventDefault();

      const textarea =
        event.currentTarget;

      const start =
        textarea.selectionStart;

      const end =
        textarea.selectionEnd;

      const current =
        tab.content.value;

      const next =
        current.slice(0, start) +
        '  ' +
        current.slice(end);

      pushHistory(next);

      requestAnimationFrame(() => {
        textarea.selectionStart =
          start + 2;

        textarea.selectionEnd =
          start + 2;

        textarea.focus();
      });

      return;
    }

    if (
      event.key === 'Enter'
    ) {
      const textarea =
        event.currentTarget;

      const start =
        textarea.selectionStart;

      const before =
        tab.content.value.slice(
          0,
          start
        );

      const currentLine =
        before.slice(
          before.lastIndexOf(
            '\n'
          ) + 1
        );

      const indentation =
        currentLine.match(
          /^[ \t]*/
        )?.[0] ?? '';

      if (indentation) {
        event.preventDefault();

        replaceSelection(
          `\n${indentation}`
        );
      }
    }
  }

  useEffect(() => {
    function onExpandSelection() {
      expandSelection();
    }

    function onCopyLine(
      event: Event
    ) {
      const customEvent =
        event as CustomEvent<{
          direction:
            | 'up'
            | 'down';
        }>;

      copyLine(
        customEvent.detail.direction
      );
    }

    function onMoveLine(
      event: Event
    ) {
      const customEvent =
        event as CustomEvent<{
          direction:
            | 'up'
            | 'down';
        }>;

      moveLine(
        customEvent.detail.direction
      );
    }

    function onSelectAll() {
      selectAll();
    }

    function onUndo() {
      undo();
    }

    function onRedo() {
      redo();
    }

    function onCut() {
      cutSelection();
    }

    function onCopy() {
      void copySelection();
    }

    function onPaste() {
      void pasteText();
    }

    window.addEventListener(
      'swiftedit-expand-selection',
      onExpandSelection
    );

    window.addEventListener(
      'swiftedit-copy-line',
      onCopyLine
    );

    window.addEventListener(
      'swiftedit-move-line',
      onMoveLine
    );

    window.addEventListener(
      'swiftedit-select-all',
      onSelectAll
    );

    window.addEventListener(
      'swiftedit-undo',
      onUndo
    );

    window.addEventListener(
      'swiftedit-redo',
      onRedo
    );

    window.addEventListener(
      'swiftedit-cut',
      onCut
    );

    window.addEventListener(
      'swiftedit-copy',
      onCopy
    );

    window.addEventListener(
      'swiftedit-paste',
      onPaste
    );

    return () => {
      window.removeEventListener(
        'swiftedit-expand-selection',
        onExpandSelection
      );

      window.removeEventListener(
        'swiftedit-copy-line',
        onCopyLine
      );

      window.removeEventListener(
        'swiftedit-move-line',
        onMoveLine
      );

      window.removeEventListener(
        'swiftedit-select-all',
        onSelectAll
      );

      window.removeEventListener(
        'swiftedit-undo',
        onUndo
      );

      window.removeEventListener(
        'swiftedit-redo',
        onRedo
      );

      window.removeEventListener(
        'swiftedit-cut',
        onCut
      );

      window.removeEventListener(
        'swiftedit-copy',
        onCopy
      );

      window.removeEventListener(
        'swiftedit-paste',
        onPaste
      );
    };
  }, [tab]);

  return (
    <textarea
      ref={ref}
      class="editor-input"
      aria-label={`Edit ${tab.path}`}
      spellcheck={false}
      value={tab.content}
      onInput={(event) => {
        const value =
          event.currentTarget.value;

        if (
          value !==
          lastContentRef.current
        ) {
          historyRef.current = [
            ...historyRef.current,
            lastContentRef.current
          ].slice(-100);

          futureRef.current = [];

          lastContentRef.current =
            value;
        }

        tab.content.value =
          value;

        window.dispatchEvent(
          new CustomEvent(
            'swiftedit-content-changed'
          )
        );
      }}
      onKeyDown={onKeyDown}
    />
  );
}