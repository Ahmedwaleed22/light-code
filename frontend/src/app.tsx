import {
  useEffect,
  useRef,
  useState
} from 'preact/hooks';

import { Editor } from './features/editor/Editor';
import { EditorToolbar } from './features/editor/EditorToolbar';
import { TabBar } from './features/editor/TabBar';

import {
  activePath,
  activeTab,
  entries,
  message,
  importLocalFiles,
  newFile,
  newFolder,
  openFile,
  refreshFiles,
  saveAsTab,
  saveTab
} from './features/editor/state';

import 'iconify-icon';

type ActivityPanel =
  | 'explorer'
  | 'search'
  | 'source'
  | 'run'
  | 'extensions'
  | 'settings'
  | 'problems'
  | 'ai';

type BottomPanel =
  | 'terminal'
  | 'output'
  | 'debug-console';

type AIMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
};

type Theme =
  | 'dark'
  | 'midnight'
  | 'light'
  | 'nord';

type Extension = {
  id: string;
  name: string;
  publisher: string;
  description: string;
  icon: string;
  category: string;
  installed: boolean;
};

const initialExtensions: Extension[] = [
  {
    id: 'prettier',
    name: 'Prettier - Code Formatter',
    publisher: 'Prettier',
    description:
      'Code formatter that keeps your JavaScript, TypeScript, HTML and CSS code clean and consistent.',
    icon: 'lucide:sparkles',
    category: 'Formatters',
    installed: false
  },
  {
    id: 'eslint',
    name: 'ESLint',
    publisher: 'Microsoft',
    description:
      'Find and highlight problems in JavaScript and TypeScript code.',
    icon: 'lucide:shield-check',
    category: 'Linters',
    installed: false
  },
  {
    id: 'tailwind',
    name: 'Tailwind CSS IntelliSense',
    publisher: 'Tailwind Labs',
    description:
      'Autocomplete, syntax highlighting and linting for Tailwind CSS.',
    icon: 'lucide:wind',
    category: 'CSS',
    installed: false
  },
  {
    id: 'live-server',
    name: 'Live Server',
    publisher: 'Ritwick Dey',
    description:
      'Launch a local development server with live reload.',
    icon: 'lucide:radio-tower',
    category: 'Development',
    installed: false
  },
  {
    id: 'gitlens',
    name: 'GitLens',
    publisher: 'GitKraken',
    description:
      'Enhanced Git information and source control tools for your editor.',
    icon: 'lucide:git-branch',
    category: 'Source Control',
    installed: false
  },
  {
    id: 'material-icons',
    name: 'Material Icon Theme',
    publisher: 'Philipp Kief',
    description:
      'Beautiful file and folder icons for your workspace.',
    icon: 'lucide:folder-tree',
    category: 'Themes',
    installed: false
  },
  {
    id: 'javascript',
    name: 'JavaScript and TypeScript',
    publisher: 'Microsoft',
    description:
      'Language support for JavaScript and TypeScript projects.',
    icon: 'lucide:file-code-2',
    category: 'Languages',
    installed: false
  },
  {
    id: 'python',
    name: 'Python',
    publisher: 'Microsoft',
    description:
      'Python language support, debugging and code navigation.',
    icon: 'lucide:braces',
    category: 'Languages',
    installed: false
  },
  {
    id: 'docker',
    name: 'Docker',
    publisher: 'Microsoft',
    description:
      'Dockerfile syntax, commands and container development tools.',
    icon: 'lucide:container',
    category: 'Development',
    installed: false
  },
  {
    id: 'markdown',
    name: 'Markdown All in One',
    publisher: 'Yu Zhang',
    description:
      'Markdown shortcuts, preview and productivity features.',
    icon: 'lucide:file-text',
    category: 'Languages',
    installed: false
  }
];

const keyboardShortcuts = [
  {
    category: 'General',
    items: [
      {
        action: 'Save',
        shortcut: 'Ctrl / Cmd + S'
      },
      {
        action: 'Save As',
        shortcut: 'Ctrl / Cmd + Shift + S'
      },
      {
        action: 'New File',
        shortcut: 'Ctrl / Cmd + N'
      },
      {
        action: 'Open File',
        shortcut: 'Ctrl / Cmd + O'
      },
      {
        action: 'Command Palette',
        shortcut: 'Ctrl / Cmd + Shift + P'
      },
      {
        action: 'Find in Files',
        shortcut: 'Ctrl / Cmd + Shift + F'
      }
    ]
  },
  {
    category: 'Editing',
    items: [
      {
        action: 'Undo',
        shortcut: 'Ctrl / Cmd + Z'
      },
      {
        action: 'Redo',
        shortcut: 'Ctrl / Cmd + Y'
      },
      {
        action: 'Cut',
        shortcut: 'Ctrl / Cmd + X'
      },
      {
        action: 'Copy',
        shortcut: 'Ctrl / Cmd + C'
      },
      {
        action: 'Paste',
        shortcut: 'Ctrl / Cmd + V'
      },
      {
        action: 'Select All',
        shortcut: 'Ctrl / Cmd + A'
      },
      {
        action: 'Indent',
        shortcut: 'Tab'
      }
    ]
  },
  {
    category: 'Selection',
    items: [
      {
        action: 'Expand Selection',
        shortcut: 'Ctrl / Cmd + Shift + A'
      },
      {
        action: 'Copy Line Up',
        shortcut: 'Alt + Shift + ↑'
      },
      {
        action: 'Copy Line Down',
        shortcut: 'Alt + Shift + ↓'
      },
      {
        action: 'Move Line Up',
        shortcut: 'Alt + ↑'
      },
      {
        action: 'Move Line Down',
        shortcut: 'Alt + ↓'
      }
    ]
  },
  {
    category: 'Panels',
    items: [
      {
        action: 'Explorer',
        shortcut: 'Activity Bar'
      },
      {
        action: 'Search',
        shortcut: 'Ctrl / Cmd + Shift + F'
      },
      {
        action: 'Extensions',
        shortcut: 'Settings → Extensions'
      },
      {
        action: 'Settings',
        shortcut: 'Activity Bar → ⚙'
      },
      {
        action: 'AI Assistant',
        shortcut: 'Activity Bar → Bot'
      }
    ]
  }
];

const themes: Array<{
  id: Theme;
  name: string;
  description: string;
  icon: string;
}> = [
  {
    id: 'dark',
    name: 'Swift Dark',
    description: 'Default dark editor theme',
    icon: 'lucide:moon'
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep blue dark theme',
    icon: 'lucide:cloud-moon'
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Clean light editor theme',
    icon: 'lucide:sun'
  },
  {
    id: 'nord',
    name: 'Nord',
    description: 'Cool blue-gray theme',
    icon: 'lucide:snowflake'
  }
];

const fontSizes = [
  12,
  13,
  14,
  16,
  18,
  20,
  22
];

export function App() {
  const [language, setLanguage] =
    useState('Select Language');

  const [isLanguageOpen, setIsLanguageOpen] =
    useState(false);

  const [isRunning, setIsRunning] =
    useState(false);

  const [openMenu, setOpenMenu] =
    useState<string | null>(null);

  const [activePanel, setActivePanel] =
    useState<ActivityPanel>('explorer');

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(true);

  const [bottomPanel, setBottomPanel] =
    useState<BottomPanel>('terminal');

  const [isBottomPanelOpen, setIsBottomPanelOpen] =
    useState(false);

  const [outputMessage, setOutputMessage] =
    useState('No output yet.');

  const [isAutoSave, setIsAutoSave] =
    useState(false);

  const autoSaveTimer =
    useRef<number | null>(null);

  const [theme, setTheme] =
    useState<Theme>('dark');

  const [fontSize, setFontSize] =
    useState(14);

  const [isShortcutsOpen, setIsShortcutsOpen] =
    useState(false);

  const [extensionSearch, setExtensionSearch] =
    useState('');

  const [extensions, setExtensions] =
    useState<Extension[]>(
      initialExtensions
    );

  /*
   * =========================================================
   * AI CHAT
   * =========================================================
   */

  const [aiInput, setAiInput] =
    useState('');

  const [isAiThinking, setIsAiThinking] =
    useState(false);

  const [aiMessages, setAiMessages] =
    useState<AIMessage[]>([
      {
        id: 1,
        role: 'assistant',
        text: 'Hi! I’m SwiftEdit AI. Ask me anything about your code, or choose one of the quick actions below.'
      }
    ]);

  /*
   * =========================================================
   * SETTINGS PERSISTENCE
   * =========================================================
   */

  useEffect(() => {
    const savedTheme =
      window.localStorage.getItem(
        'swiftedit-theme'
      ) as Theme | null;

    const savedFontSize =
      Number(
        window.localStorage.getItem(
          'swiftedit-font-size'
        )
      );

    if (
      savedTheme &&
      themes.some(
        (item) => item.id === savedTheme
      )
    ) {
      setTheme(savedTheme);
    }

    if (
      fontSizes.includes(savedFontSize)
    ) {
      setFontSize(savedFontSize);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      'swiftedit-theme',
      theme
    );
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(
      'swiftedit-font-size',
      String(fontSize)
    );
  }, [fontSize]);

  /*
   * =========================================================
   * FILE + KEYBOARD EVENTS
   * =========================================================
   */

  useEffect(() => {
    void refreshFiles();

    function handleKeyboard(
      event: KeyboardEvent
    ) {
      const key =
        event.key.toLowerCase();

      const modifier =
        event.ctrlKey ||
        event.metaKey;

      if (
        modifier &&
        event.shiftKey &&
        key === 'p'
      ) {
        event.preventDefault();
        return;
      }

      if (!modifier) {
        return;
      }

      if (key === 'n') {
        event.preventDefault();
        handleNewFile();
        return;
      }

      if (
        key === 'o' &&
        !event.shiftKey
      ) {
        event.preventDefault();
        handleOpenFile();
        return;
      }

      if (
        key === 's' &&
        event.shiftKey
      ) {
        event.preventDefault();
        handleSaveAs();
        return;
      }

      if (
        key === 's' &&
        !event.shiftKey
      ) {
        event.preventDefault();
        handleSave();
        return;
      }

      if (
        key === 'f' &&
        event.shiftKey
      ) {
        event.preventDefault();
        handleFindInFiles();
      }
    }

    function handleSaveAsEvent() {
      handleSaveAs();
    }

    function handleContentChanged() {
      if (!isAutoSave) {
        return;
      }

      if (!activeTab.value) {
        return;
      }

      if (
        autoSaveTimer.current !==
        null
      ) {
        window.clearTimeout(
          autoSaveTimer.current
        );
      }

      autoSaveTimer.current =
        window.setTimeout(() => {
          const tab =
            activeTab.value;

          if (tab) {
            void saveTab(tab);
          }
        }, 700);
    }

    window.addEventListener(
      'keydown',
      handleKeyboard
    );

    window.addEventListener(
      'swiftedit-save-as',
      handleSaveAsEvent
    );

    window.addEventListener(
      'swiftedit-content-changed',
      handleContentChanged
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyboard
      );

      window.removeEventListener(
        'swiftedit-save-as',
        handleSaveAsEvent
      );

      window.removeEventListener(
        'swiftedit-content-changed',
        handleContentChanged
      );

      if (
        autoSaveTimer.current !==
        null
      ) {
        window.clearTimeout(
          autoSaveTimer.current
        );
      }
    };
  }, [isAutoSave]);

  /*
   * =========================================================
   * FILE ACTIONS
   * =========================================================
   */

  function handleNewFile() {
    const name =
      window.prompt(
        'Enter file name:',
        'untitled.js'
      );

    if (
      name &&
      name.trim() !== ''
    ) {
      void newFile(
        name.trim()
      );
    }

    closeMenus();
  }

  function handleNewFolder() {
    const name =
      window.prompt(
        'Enter folder name:'
      );

    if (
      name &&
      name.trim() !== ''
    ) {
      void newFolder(
        name.trim()
      );
    }

    closeMenus();
  }

  function handleOpenFile() {
    const input =
      document.createElement(
        'input'
      );

    input.type = 'file';
    input.multiple = false;

    input.onchange = () => {
      const files =
        input.files;

      if (
        files &&
        files.length > 0
      ) {
        void importLocalFiles(
          Array.from(files)
        );
      }
    };

    input.click();

    closeMenus();
  }

  function handleOpenFolder() {
    const input =
      document.createElement(
        'input'
      );

    input.type = 'file';
    input.multiple = true;

    input.setAttribute(
      'webkitdirectory',
      ''
    );

    input.setAttribute(
      'directory',
      ''
    );

    input.onchange = () => {
      const files =
        input.files;

      if (files) {
        void importLocalFiles(
          Array.from(files)
        );
      }
    };

    input.click();

    closeMenus();
  }

  function getCurrentFileName() {
    if (!activePath.value) {
      return 'untitled.txt';
    }

    const parts =
      activePath.value.split('/');

    return (
      parts[
        parts.length - 1
      ] ||
      'untitled.txt'
    );
  }

  function getCurrentFileContent() {
    const tab =
      activeTab.value;

    if (!tab) {
      return '';
    }

    return tab.content.value;
  }

  async function handleSave() {
    const tab =
      activeTab.value;

    if (!tab) {
      window.alert(
        'Open or create a file first.'
      );

      closeMenus();
      return;
    }

    await saveTab(tab);

    setOutputMessage(
      `Saved ${tab.path}`
    );

    closeMenus();
  }

  async function handleSaveAs() {
    const tab =
      activeTab.value;

    if (!tab) {
      window.alert(
        'Open or create a file first.'
      );

      closeMenus();
      return;
    }

    const currentName =
      getCurrentFileName();

    const name =
      window.prompt(
        'Save file as:',
        currentName
      );

    if (
      !name ||
      !name.trim()
    ) {
      closeMenus();
      return;
    }

    const cleanName =
      name.trim();

    await saveAsTab(
      tab,
      cleanName
    );

    setOutputMessage(
      `Saved as ${cleanName}`
    );

    closeMenus();
  }

  function handleAutoSaveToggle() {
    setIsAutoSave(
      (current) => !current
    );

    setOpenMenu(null);
  }

  function handleExit() {
    closeMenus();

    window.close();

    window.setTimeout(() => {
      window.alert(
        'The browser blocked closing this tab. You can close the tab manually.'
      );
    }, 100);
  }

  /*
   * =========================================================
   * EDIT ACTIONS
   * =========================================================
   */

  function dispatchEditorEvent(
    eventName: string
  ) {
    window.dispatchEvent(
      new CustomEvent(
        eventName
      )
    );

    closeMenus();
  }

  function handleCopy() {
    dispatchEditorEvent(
      'swiftedit-copy'
    );
  }

  function handlePaste() {
    dispatchEditorEvent(
      'swiftedit-paste'
    );
  }

  function handleCut() {
    dispatchEditorEvent(
      'swiftedit-cut'
    );
  }

  function handleUndo() {
    dispatchEditorEvent(
      'swiftedit-undo'
    );
  }

  function handleRedo() {
    dispatchEditorEvent(
      'swiftedit-redo'
    );
  }

  function handleFindInFiles() {
    setActivePanel('search');
    setIsSidebarOpen(true);
    closeMenus();
  }

  /*
   * =========================================================
   * SELECTION ACTIONS
   * =========================================================
   */

  function handleSelectAll() {
    dispatchEditorEvent(
      'swiftedit-select-all'
    );
  }

  function handleExpandSelection() {
    window.dispatchEvent(
      new CustomEvent(
        'swiftedit-expand-selection'
      )
    );

    closeMenus();
  }

  function handleCopyLine(
    direction: 'up' | 'down'
  ) {
    window.dispatchEvent(
      new CustomEvent(
        'swiftedit-copy-line',
        {
          detail: {
            direction
          }
        }
      )
    );

    closeMenus();
  }

  function handleMoveLine(
    direction: 'up' | 'down'
  ) {
    window.dispatchEvent(
      new CustomEvent(
        'swiftedit-move-line',
        {
          detail: {
            direction
          }
        }
      )
    );

    closeMenus();
  }

  /*
   * =========================================================
   * PANELS
   * =========================================================
   */

  function openBottomPanel(
    panel: BottomPanel
  ) {
    setBottomPanel(panel);
    setIsBottomPanelOpen(true);

    setOpenMenu(null);
    setIsLanguageOpen(false);
  }

  function closeBottomPanel() {
    setIsBottomPanelOpen(false);
  }

  function openViewPanel(
    panel: ActivityPanel
  ) {
    setActivePanel(panel);
    setIsSidebarOpen(true);
    closeMenus();
  }

  function closeSidebar() {
    setIsSidebarOpen(false);
  }

  /*
   * =========================================================
   * RUN
   * =========================================================
   */

  function handleRun() {
    setIsRunning(true);

    setBottomPanel('output');
    setIsBottomPanelOpen(true);

    setOutputMessage(
      'Running your program...'
    );

    closeMenus();

    window.setTimeout(() => {
      setIsRunning(false);

      setOutputMessage(
        'Process finished successfully. Code execution is not connected yet.'
      );
    }, 1000);
  }

  /*
   * =========================================================
   * LANGUAGE
   * =========================================================
   */

  function handleLanguageChange(
    selectedLanguage: string
  ) {
    setLanguage(
      selectedLanguage
    );

    setIsLanguageOpen(false);
  }

  /*
   * =========================================================
   * MENUS
   * =========================================================
   */

  function toggleMenu(
    menu: string
  ) {
    setOpenMenu(
      (current) =>
        current === menu
          ? null
          : menu
    );

    setIsLanguageOpen(false);
  }

  function closeMenus() {
    setOpenMenu(null);
    setIsLanguageOpen(false);
  }

  function handleActivityPanel(
    panel: ActivityPanel
  ) {
    setActivePanel(panel);
    setIsSidebarOpen(true);
    closeMenus();
  }

  /*
   * =========================================================
   * SETTINGS
   * =========================================================
   */

  function handleThemeChange(
    selectedTheme: Theme
  ) {
    setTheme(selectedTheme);

    setOutputMessage(
      `Theme changed to ${
        themes.find(
          (item) =>
            item.id === selectedTheme
        )?.name
      }`
    );
  }

  function handleFontSizeChange(
    size: number
  ) {
    setFontSize(size);

    setOutputMessage(
      `Editor font size changed to ${size}px`
    );
  }

  function handleShare() {
    const url =
      window.location.href;

    if (
      'share' in navigator &&
      typeof navigator.share ===
        'function'
    ) {
      navigator
        .share({
          title: 'SwiftEdit Project',
          text: 'Check out my SwiftEdit project',
          url
        })
        .catch(() => undefined);

      return;
    }

    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setOutputMessage(
          'Project link copied to clipboard.'
        );
      })
      .catch(() => {
        setOutputMessage(
          'Could not copy project link.'
        );
      });
  }

  /*
   * =========================================================
   * EXTENSIONS
   * =========================================================
   */

  function toggleExtension(
    extensionId: string
  ) {
    setExtensions(
      (current) =>
        current.map(
          (extension) => {
            if (
              extension.id !==
              extensionId
            ) {
              return extension;
            }

            const installed =
              !extension.installed;

            setOutputMessage(
              installed
                ? `${extension.name} installed.`
                : `${extension.name} uninstalled.`
            );

            return {
              ...extension,
              installed
            };
          }
        )
    );
  }

  const filteredExtensions =
    extensions.filter(
      (extension) => {
        const search =
          extensionSearch
            .toLowerCase()
            .trim();

        if (!search) {
          return true;
        }

        return (
          extension.name
            .toLowerCase()
            .includes(search) ||
          extension.publisher
            .toLowerCase()
            .includes(search) ||
          extension.description
            .toLowerCase()
            .includes(search) ||
          extension.category
            .toLowerCase()
            .includes(search)
        );
      }
    );

  /*
   * =========================================================
   * AI HELPERS
   * =========================================================
   */

  function openAI() {
    setActivePanel('ai');
    setIsSidebarOpen(true);
    setOpenMenu(null);
    setIsLanguageOpen(false);
  }

  function clearAIChat() {
    setAiMessages([
      {
        id: Date.now(),
        role: 'assistant',
        text: 'New conversation started. How can I help you with your code?'
      }
    ]);

    setAiInput('');
    setIsAiThinking(false);
  }

  function getAIResponse(
    question: string
  ) {
    const lower =
      question.toLowerCase();

    if (
      lower.includes('explain') ||
      lower.includes('شرح')
    ) {
      return 'Sure. Send me the code you want explained and I’ll break it down step by step in simple terms.';
    }

    if (
      lower.includes('fix') ||
      lower.includes('error') ||
      lower.includes('bug')
    ) {
      return 'I can help fix it. Send me the error message or the relevant code and I’ll identify the problem and suggest a corrected version.';
    }

    if (
      lower.includes('optimize') ||
      lower.includes('performance')
    ) {
      return 'I can optimize your code for readability, performance, and maintainability. Send me the code and I’ll suggest improvements.';
    }

    return 'I’m ready to help with your code. Once we connect the AI API, I’ll be able to analyze your actual project and generate detailed answers here.';
  }

  function sendAIMessage(
    customMessage?: string
  ) {
    const text = (
      customMessage ??
      aiInput
    ).trim();

    if (
      !text ||
      isAiThinking
    ) {
      return;
    }

    const userMessage: AIMessage = {
      id: Date.now(),
      role: 'user',
      text
    };

    setAiMessages(
      (current) => [
        ...current,
        userMessage
      ]
    );

    setAiInput('');
    setIsAiThinking(true);

    window.setTimeout(() => {
      const response =
        getAIResponse(text);

      setAiMessages(
        (current) => [
          ...current,
          {
            id:
              Date.now() + 1,
            role: 'assistant',
            text: response
          }
        ]
      );

      setIsAiThinking(false);
    }, 900);
  }

  function sendCurrentCodeToAI(
    action:
      | 'explain'
      | 'fix'
      | 'optimize'
  ) {
    const fileName =
      getCurrentFileName();

    const content =
      getCurrentFileContent();

    if (!activeTab.value) {
      sendAIMessage(
        action === 'explain'
          ? 'Explain my current code'
          : action === 'fix'
            ? 'Fix my current code'
            : 'Optimize my current code'
      );

      return;
    }

    let request = '';

    if (
      action === 'explain'
    ) {
      request =
        `Explain this code from ${fileName} step by step:\n\n${content}`;
    }

    if (
      action === 'fix'
    ) {
      request =
        `Find possible bugs and suggest fixes for this code from ${fileName}:\n\n${content}`;
    }

    if (
      action === 'optimize'
    ) {
      request =
        `Optimize this code from ${fileName} for readability and performance:\n\n${content}`;
    }

    sendAIMessage(request);
  }

  /*
   * =========================================================
   * RETURN
   * =========================================================
   */

  return (
    <div
      class={`shell theme-${theme}`}
      style={{
        '--swiftedit-font-size': `${fontSize}px`
      }}
      onClick={closeMenus}
    >
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">
            ⌘
          </span>

          <span>
            SwiftEdit
          </span>
        </div>

        <nav
          class="menu-bar"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          {/* FILE */}
          <div class="menu-wrapper">
            <button
              class={`menu-button ${
                openMenu === 'file'
                  ? 'active'
                  : ''
              }`}
              type="button"
              onClick={() =>
                toggleMenu('file')
              }
            >
              File
            </button>

            {openMenu === 'file' && (
              <div class="top-menu">
                <div class="menu-title">
                  File
                </div>

                <button
                  type="button"
                  onClick={handleNewFile}
                >
                  <span>New File</span>
                  <kbd>Ctrl+N</kbd>
                </button>

                <button
                  type="button"
                  onClick={handleNewFolder}
                >
                  <span>New Folder</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenFile}
                >
                  <span>Open File...</span>
                  <kbd>Ctrl+O</kbd>
                </button>

                <button
                  type="button"
                  onClick={handleOpenFolder}
                >
                  <span>Open Folder...</span>
                </button>

                <div class="menu-divider" />

                <button
                  type="button"
                  onClick={handleSave}
                >
                  <span>Save</span>
                  <kbd>Ctrl+S</kbd>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAs}
                >
                  <span>Save As...</span>
                  <kbd>Ctrl+Shift+S</kbd>
                </button>

                <button
                  type="button"
                  onClick={handleAutoSaveToggle}
                >
                  <span>Auto Save</span>
                  <span>
                    {isAutoSave ? '✓' : ''}
                  </span>
                </button>

                <div class="menu-divider" />

                <button
                  type="button"
                  onClick={handleExit}
                >
                  <span>Exit</span>
                </button>
              </div>
            )}
          </div>

          {/* EDIT */}
          <div class="menu-wrapper">
            <button
              class={`menu-button ${
                openMenu === 'edit'
                  ? 'active'
                  : ''
              }`}
              type="button"
              onClick={() =>
                toggleMenu('edit')
              }
            >
              Edit
            </button>

            {openMenu === 'edit' && (
              <div class="top-menu">
                <div class="menu-title">
                  Edit
                </div>

                <button
                  type="button"
                  onClick={handleUndo}
                >
                  <span>Undo</span>
                  <kbd>Ctrl+Z</kbd>
                </button>

                <button
                  type="button"
                  onClick={handleRedo}
                >
                  <span>Redo</span>
                  <kbd>Ctrl+Y</kbd>
                </button>

                <div class="menu-divider" />

                <button
                  type="button"
                  onClick={handleCut}
                >
                  <span>Cut</span>
                  <kbd>Ctrl+X</kbd>
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                >
                  <span>Copy</span>
                  <kbd>Ctrl+C</kbd>
                </button>

                <button
                  type="button"
                  onClick={handlePaste}
                >
                  <span>Paste</span>
                  <kbd>Ctrl+V</kbd>
                </button>

                <div class="menu-divider" />

                <button
                  type="button"
                  onClick={handleFindInFiles}
                >
                  <span>Find in Files</span>
                  <kbd>Ctrl+Shift+F</kbd>
                </button>
              </div>
            )}
          </div>

          {/* SELECTION */}
          <div class="menu-wrapper">
            <button
              class={`menu-button ${
                openMenu === 'selection'
                  ? 'active'
                  : ''
              }`}
              type="button"
              onClick={() =>
                toggleMenu('selection')
              }
            >
              Selection
            </button>

            {openMenu === 'selection' && (
              <div class="top-menu">
                <div class="menu-title">
                  Selection
                </div>

                <button
                  type="button"
                  onClick={handleSelectAll}
                >
                  <span>Select All</span>
                  <kbd>Ctrl+A</kbd>
                </button>

                <button
                  type="button"
                  onClick={handleExpandSelection}
                >
                  <span>
                    Expand Selection
                  </span>
                </button>

                <div class="menu-divider" />

                <button
                  type="button"
                  onClick={() =>
                    handleCopyLine('up')
                  }
                >
                  Copy Line Up
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCopyLine('down')
                  }
                >
                  Copy Line Down
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleMoveLine('up')
                  }
                >
                  Move Line Up
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleMoveLine('down')
                  }
                >
                  Move Line Down
                </button>
              </div>
            )}
          </div>

          {/* VIEW */}
          <div class="menu-wrapper">
            <button
              class={`menu-button ${
                openMenu === 'view'
                  ? 'active'
                  : ''
              }`}
              type="button"
              onClick={() =>
                toggleMenu('view')
              }
            >
              View
            </button>

            {openMenu === 'view' && (
              <div class="top-menu">
                <div class="menu-title">
                  View
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openViewPanel('explorer')
                  }
                >
                  Explorer
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openViewPanel('search')
                  }
                >
                  Search
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openViewPanel('source')
                  }
                >
                  Source Control
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openViewPanel('run')
                  }
                >
                  Run
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openViewPanel('extensions')
                  }
                >
                  Extensions
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openViewPanel('problems')
                  }
                >
                  Problems
                </button>

                <div class="menu-divider" />

                <button
                  type="button"
                  onClick={() =>
                    openBottomPanel('output')
                  }
                >
                  Output
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openBottomPanel('debug-console')
                  }
                >
                  Debug Console
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openBottomPanel('terminal')
                  }
                >
                  Terminal
                </button>
              </div>
            )}
          </div>

          {/* MORE */}
          <div class="menu-wrapper">
            <button
              class={`menu-button more-button ${
                openMenu === 'more'
                  ? 'active'
                  : ''
              }`}
              type="button"
              title="More"
              onClick={() =>
                toggleMenu('more')
              }
            >
              •••
            </button>

            {openMenu === 'more' && (
              <div class="top-menu more-menu">
                <div class="menu-title">
                  More
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openBottomPanel('terminal')
                  }
                >
                  <span>
                    <iconify-icon
                      icon="lucide:terminal"
                      width="16"
                      height="16"
                    />
                    New Terminal
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openBottomPanel('terminal')
                  }
                >
                  <span>
                    <iconify-icon
                      icon="lucide:columns-2"
                      width="16"
                      height="16"
                    />
                    Split Terminal
                  </span>
                </button>

                <div class="menu-divider" />

                <button
                  type="button"
                  onClick={() => {
                    window.alert(
                      'SwiftEdit Help\n\nUse File to create, open and save files.\n\nUse Edit to undo, redo, cut, copy and paste.\n\nUse Selection to work with lines and selections.\n\nUse View to switch between panels.'
                    );

                    closeMenus();
                  }}
                >
                  <span>
                    <iconify-icon
                      icon="lucide:circle-help"
                      width="16"
                      height="16"
                    />
                    Help
                  </span>
                </button>
              </div>
            )}
          </div>
        </nav>

        <span class="topbar-label">
          WORKSPACE
        </span>

        <div
          class="top-actions"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <div class="language-dropdown">
            <button
              class="language-button"
              type="button"
              onClick={() =>
                setIsLanguageOpen(
                  !isLanguageOpen
                )
              }
            >
              {language}

              <span class="dropdown-arrow">
                ⌄
              </span>
            </button>

            {isLanguageOpen && (
              <div class="language-menu">
                <div class="menu-title">
                  Language
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleLanguageChange(
                      'JavaScript'
                    )
                  }
                >
                  JavaScript
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleLanguageChange(
                      'HTML'
                    )
                  }
                >
                  HTML
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleLanguageChange(
                      'CSS'
                    )
                  }
                >
                  CSS
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleLanguageChange(
                      'Python'
                    )
                  }
                >
                  Python
                </button>
              </div>
            )}
          </div>

          <button
            class="run-button"
            type="button"
            onClick={handleRun}
            disabled={isRunning}
          >
            <span class="run-icon">
              {isRunning ? '◌' : '▶'}
            </span>

            {isRunning
              ? 'Running...'
              : 'Run'}
          </button>

          <button
            class="top-action"
            type="button"
            onClick={handleNewFile}
          >
            + New file
          </button>
        </div>
      </header>

      <div class="workspace">
        <aside
          class="activity-bar"
          aria-label="Activity Bar"
        >
          <button
            type="button"
            class={`activity-button ${
              activePanel === 'explorer' &&
              isSidebarOpen
                ? 'active'
                : ''
            }`}
            title="Explorer"
            aria-label="Explorer"
            onClick={() =>
              handleActivityPanel(
                'explorer'
              )
            }
          >
            <iconify-icon
              icon="lucide:files"
              width="23"
              height="23"
            />

            {activePanel === 'explorer' &&
              isSidebarOpen && (
                <span class="activity-indicator" />
              )}
          </button>

          <button
            type="button"
            class={`activity-button ${
              activePanel === 'search' &&
              isSidebarOpen
                ? 'active'
                : ''
            }`}
            title="Search"
            aria-label="Search"
            onClick={() =>
              handleActivityPanel(
                'search'
              )
            }
          >
            <iconify-icon
              icon="lucide:search"
              width="23"
              height="23"
            />

            {activePanel === 'search' &&
              isSidebarOpen && (
                <span class="activity-indicator" />
              )}
          </button>

          <button
            type="button"
            class={`activity-button ${
              activePanel === 'source' &&
              isSidebarOpen
                ? 'active'
                : ''
            }`}
            title="Source Control"
            aria-label="Source Control"
            onClick={() =>
              handleActivityPanel(
                'source'
              )
            }
          >
            <iconify-icon
              icon="lucide:git-branch"
              width="23"
              height="23"
            />

            {activePanel === 'source' &&
              isSidebarOpen && (
                <span class="activity-indicator" />
              )}
          </button>

          <button
            type="button"
            class={`activity-button ${
              activePanel === 'run' &&
              isSidebarOpen
                ? 'active'
                : ''
            }`}
            title="Run and Debug"
            aria-label="Run and Debug"
            onClick={() =>
              handleActivityPanel(
                'run'
              )
            }
          >
            <iconify-icon
              icon="lucide:circle-play"
              width="23"
              height="23"
            />

            {activePanel === 'run' &&
              isSidebarOpen && (
                <span class="activity-indicator" />
              )}
          </button>

          <button
            type="button"
            class={`activity-button ${
              activePanel === 'extensions' &&
              isSidebarOpen
                ? 'active'
                : ''
            }`}
            title="Extensions"
            aria-label="Extensions"
            onClick={() =>
              handleActivityPanel(
                'extensions'
              )
            }
          >
            <iconify-icon
              icon="lucide:blocks"
              width="23"
              height="23"
            />

            {activePanel === 'extensions' &&
              isSidebarOpen && (
                <span class="activity-indicator" />
              )}
          </button>

          <button
            type="button"
            class={`activity-button ai-activity-button ${
              activePanel === 'ai' &&
              isSidebarOpen
                ? 'active'
                : ''
            }`}
            title="AI Assistant"
            aria-label="AI Assistant"
            onClick={openAI}
          >
            <iconify-icon
              icon="lucide:bot"
              width="23"
              height="23"
            />

            {activePanel === 'ai' &&
              isSidebarOpen && (
                <span class="activity-indicator" />
              )}
          </button>

          <div class="activity-spacer" />

          <button
            type="button"
            class={`activity-button settings-button ${
              activePanel === 'settings' &&
              isSidebarOpen
                ? 'active'
                : ''
            }`}
            title="Settings"
            aria-label="Settings"
            onClick={() =>
              handleActivityPanel(
                'settings'
              )
            }
          >
            <iconify-icon
              icon="lucide:settings"
              width="23"
              height="23"
            />

            {activePanel === 'settings' &&
              isSidebarOpen && (
                <span class="activity-indicator" />
              )}
          </button>
        </aside>

        {isSidebarOpen && (
          <aside
            class={`sidebar ${
              activePanel === 'ai'
                ? 'ai-sidebar'
                : ''
            }`}
            aria-label="Side Panel"
          >
            {/* AI */}
            {activePanel === 'ai' && (
              <div class="ai-panel">
                <div class="ai-header">
                  <div class="ai-title">
                    <div class="ai-title-icon">
                      <iconify-icon
                        icon="lucide:bot"
                        width="17"
                        height="17"
                      />
                    </div>

                    <div>
                      <strong>
                        AI Assistant
                      </strong>

                      <span>
                        SwiftEdit AI
                      </span>
                    </div>
                  </div>

                  <div class="ai-header-actions">
                    <button
                      type="button"
                      title="New Chat"
                      onClick={
                        clearAIChat
                      }
                    >
                      <iconify-icon
                        icon="lucide:plus"
                        width="15"
                        height="15"
                      />
                    </button>

                    <button
                      type="button"
                      title="Clear Chat"
                      onClick={
                        clearAIChat
                      }
                    >
                      <iconify-icon
                        icon="lucide:trash-2"
                        width="15"
                        height="15"
                      />
                    </button>

                    <button
                      type="button"
                      title="Close AI Assistant"
                      aria-label="Close AI Assistant"
                      onClick={
                        closeSidebar
                      }
                    >
                      <iconify-icon
                        icon="lucide:x"
                        width="16"
                        height="16"
                      />
                    </button>
                  </div>
                </div>

                <div class="ai-chat">
                  {aiMessages.map(
                    (item) => (
                      <div
                        key={item.id}
                        class={`ai-message ${
                          item.role === 'user'
                            ? 'user-message'
                            : 'assistant-message'
                        }`}
                      >
                        {item.role ===
                          'assistant' && (
                          <div class="ai-avatar">
                            <iconify-icon
                              icon="lucide:bot"
                              width="14"
                              height="14"
                            />
                          </div>
                        )}

                        <div class="ai-message-content">
                          <div class="ai-message-role">
                            {item.role ===
                            'user'
                              ? 'You'
                              : 'SwiftEdit AI'}
                          </div>

                          <div class="ai-message-text">
                            {item.text}
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {isAiThinking && (
                    <div class="ai-message assistant-message">
                      <div class="ai-avatar">
                        <iconify-icon
                          icon="lucide:bot"
                          width="14"
                          height="14"
                        />
                      </div>

                      <div class="ai-message-content">
                        <div class="ai-message-role">
                          SwiftEdit AI
                        </div>

                        <div class="ai-thinking">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div class="ai-quick-actions">
                  <button
                    type="button"
                    onClick={() =>
                      sendCurrentCodeToAI(
                        'explain'
                      )
                    }
                  >
                    <iconify-icon
                      icon="lucide:book-open"
                      width="14"
                      height="14"
                    />
                    Explain Code
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      sendCurrentCodeToAI(
                        'fix'
                      )
                    }
                  >
                    <iconify-icon
                      icon="lucide:wrench"
                      width="14"
                      height="14"
                    />
                    Fix Code
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      sendCurrentCodeToAI(
                        'optimize'
                      )
                    }
                  >
                    <iconify-icon
                      icon="lucide:zap"
                      width="14"
                      height="14"
                    />
                    Optimize
                  </button>
                </div>

                <div class="ai-input-area">
                  <div class="ai-input-wrapper">
                    <textarea
                      value={aiInput}
                      placeholder="Ask AI anything..."
                      rows={2}
                      onInput={(event) => {
                        setAiInput(
                          event.currentTarget.value
                        );
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key ===
                            'Enter' &&
                          !event.shiftKey
                        ) {
                          event.preventDefault();
                          sendAIMessage();
                        }
                      }}
                    />

                    <button
                      type="button"
                      class="ai-send-button"
                      title="Send"
                      disabled={
                        !aiInput.trim() ||
                        isAiThinking
                      }
                      onClick={() =>
                        sendAIMessage()
                      }
                    >
                      <iconify-icon
                        icon="lucide:arrow-up"
                        width="17"
                        height="17"
                      />
                    </button>
                  </div>

                  <div class="ai-input-hint">
                    Enter to send · Shift+Enter for new line
                  </div>
                </div>
              </div>
            )}

            {/* EXPLORER */}
            {activePanel ===
              'explorer' && (
              <>
                <div class="sidebar-heading">
                  <span>
                    EXPLORER
                  </span>

                  <div class="explorer-actions">
                    <button
                      type="button"
                      class="explorer-action"
                      title="Open Folder"
                      aria-label="Open Folder"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenFolder();
                      }}
                    >
                      <iconify-icon
                        icon="lucide:folder-open"
                        width="16"
                        height="16"
                      />
                    </button>

                    <button
                      type="button"
                      class="explorer-action"
                      title="New File"
                      aria-label="New File"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNewFile();
                      }}
                    >
                      <iconify-icon
                        icon="lucide:file-plus-2"
                        width="16"
                        height="16"
                      />
                    </button>

                    <button
                      type="button"
                      class="explorer-action"
                      title="New Folder"
                      aria-label="New Folder"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNewFolder();
                      }}
                    >
                      <iconify-icon
                        icon="lucide:folder-plus"
                        width="16"
                        height="16"
                      />
                    </button>
                  </div>

                  <button
                    class="explorer-refresh"
                    title="Refresh files"
                    type="button"
                    onClick={() =>
                      void refreshFiles()
                    }
                  >
                    <iconify-icon
                      icon="lucide:refresh-cw"
                      width="15"
                      height="15"
                    />
                  </button>

                  <button
                    type="button"
                    title="Close Explorer"
                    aria-label="Close Explorer"
                    onClick={closeSidebar}
                    class="panel-close-button"
                  >
                    ×
                  </button>
                </div>

                <div class="file-list">
                  {entries.value.length ===
                    0 && (
                    <p class="empty-list">
                      No files yet. Create one to
                      begin.
                    </p>
                  )}

                  {entries.value.map(
                    (entry) => (
                      <button
                        key={entry.path}
                        class={`file-row ${
                          entry.kind ===
                          'directory'
                            ? 'directory'
                            : ''
                        } ${
                          activePath.value ===
                          entry.path
                            ? 'selected'
                            : ''
                        }`}
                        style={{
                          paddingLeft:
                            `${
                              12 +
                              (
                                entry.path.split(
                                  '/'
                                ).length -
                                1
                              ) *
                                14
                            }px`
                        }}
                        disabled={
                          entry.kind ===
                          'directory'
                        }
                        onClick={() =>
                          void openFile(
                            entry.path
                          )
                        }
                        title={entry.path}
                      >
                        <span class="file-icon">
                          {entry.kind ===
                          'directory'
                            ? '▸'
                            : '≡'}
                        </span>

                        <span class="file-name">
                          {entry.name}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </>
            )}

            {/* SEARCH */}
            {activePanel ===
              'search' && (
              <div class="activity-panel-content">
                <div class="activity-panel-header">
                  <span>
                    SEARCH
                  </span>

                  <button
                    type="button"
                    title="Close Search"
                    aria-label="Close Search"
                    onClick={closeSidebar}
                    class="panel-close-button"
                  >
                    ×
                  </button>
                </div>

                <div class="search-box">
                  <iconify-icon
                    icon="lucide:search"
                    width="16"
                    height="16"
                  />

                  <input
                    type="text"
                    placeholder="Search"
                  />
                </div>

                <div class="panel-empty">
                  <iconify-icon
                    icon="lucide:search"
                    width="30"
                    height="30"
                  />

                  <p>
                    Search across your files
                  </p>
                </div>
              </div>
            )}

            {/* SOURCE */}
            {activePanel ===
              'source' && (
              <div class="activity-panel-content">
                <div class="activity-panel-header">
                  <span>
                    SOURCE CONTROL
                  </span>

                  <button
                    type="button"
                    onClick={closeSidebar}
                    class="panel-close-button"
                  >
                    ×
                  </button>
                </div>

                <div class="source-control-box">
                  <div class="source-control-title">
                    <iconify-icon
                      icon="lucide:git-branch"
                      width="18"
                      height="18"
                    />

                    <span>
                      Source Control
                    </span>
                  </div>

                  <p>
                    No source control changes
                  </p>

                  <button
                    type="button"
                    class="panel-action-button"
                  >
                    Initialize Repository
                  </button>
                </div>
              </div>
            )}

            {/* RUN */}
            {activePanel ===
              'run' && (
              <div class="activity-panel-content">
                <div class="activity-panel-header">
                  <span>
                    RUN AND DEBUG
                  </span>

                  <button
                    type="button"
                    onClick={closeSidebar}
                    class="panel-close-button"
                  >
                    ×
                  </button>
                </div>

                <div class="run-debug-content">
                  <iconify-icon
                    icon="lucide:circle-play"
                    width="34"
                    height="34"
                  />

                  <h3>
                    Run and Debug
                  </h3>

                  <p>
                    Start your program and inspect
                    its output here.
                  </p>

                  <button
                    type="button"
                    class="panel-action-button run-panel-button"
                    onClick={handleRun}
                  >
                    <iconify-icon
                      icon="lucide:play"
                      width="15"
                      height="15"
                    />

                    Run
                  </button>
                </div>
              </div>
            )}

            {/* EXTENSIONS */}
            {activePanel ===
              'extensions' && (
              <div class="activity-panel-content extensions-panel">
                <div class="activity-panel-header">
                  <div>
                    <span>
                      EXTENSIONS
                    </span>

                    <small>
                      {extensions.filter(
                        (item) =>
                          item.installed
                      ).length}{' '}
                      installed
                    </small>
                  </div>

                  <button
                    type="button"
                    title="Close Extensions"
                    aria-label="Close Extensions"
                    onClick={closeSidebar}
                    class="panel-close-button"
                  >
                    ×
                  </button>
                </div>

                <div class="search-box extension-search">
                  <iconify-icon
                    icon="lucide:search"
                    width="16"
                    height="16"
                  />

                  <input
                    type="text"
                    value={extensionSearch}
                    placeholder="Search Extensions"
                    onInput={(event) =>
                      setExtensionSearch(
                        event.currentTarget.value
                      )
                    }
                  />

                  {extensionSearch && (
                    <button
                      type="button"
                      onClick={() =>
                        setExtensionSearch('')
                      }
                    >
                      ×
                    </button>
                  )}
                </div>

                <div class="extension-list">
                  {filteredExtensions.length ===
                    0 ? (
                    <div class="panel-empty">
                      <iconify-icon
                        icon="lucide:search-x"
                        width="30"
                        height="30"
                      />

                      <p>
                        No extensions found.
                      </p>
                    </div>
                  ) : (
                    filteredExtensions.map(
                      (extension) => (
                        <div
                          key={
                            extension.id
                          }
                          class={`extension-card ${
                            extension.installed
                              ? 'installed'
                              : ''
                          }`}
                        >
                          <div class="extension-icon">
                            <iconify-icon
                              icon={
                                extension.icon
                              }
                              width="24"
                              height="24"
                            />
                          </div>

                          <div class="extension-info">
                            <strong>
                              {extension.name}
                            </strong>

                            <span class="extension-publisher">
                              {extension.publisher}
                            </span>

                            <p>
                              {
                                extension.description
                              }
                            </p>

                            <span class="extension-category">
                              {extension.category}
                            </span>
                          </div>

                          <button
                            type="button"
                            class={`extension-install-button ${
                              extension.installed
                                ? 'installed'
                                : ''
                            }`}
                            onClick={() =>
                              toggleExtension(
                                extension.id
                              )
                            }
                          >
                            {extension.installed
                              ? 'Installed'
                              : 'Install'}
                          </button>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            )}

            {/* PROBLEMS */}
            {activePanel ===
              'problems' && (
              <div class="activity-panel-content">
                <div class="activity-panel-header">
                  <span>
                    PROBLEMS
                  </span>

                  <button
                    type="button"
                    onClick={closeSidebar}
                    class="panel-close-button"
                  >
                    ×
                  </button>
                </div>

                <div class="panel-empty">
                  <iconify-icon
                    icon="lucide:circle-check"
                    width="30"
                    height="30"
                  />

                  <p>
                    No problems detected.
                  </p>
                </div>
              </div>
            )}

            {/* SETTINGS */}
            {activePanel ===
              'settings' && (
              <div class="activity-panel-content settings-panel">
                <div class="activity-panel-header">
                  <span>
                    SETTINGS
                  </span>

                  <button
                    type="button"
                    title="Close Settings"
                    aria-label="Close Settings"
                    onClick={closeSidebar}
                    class="panel-close-button"
                  >
                    ×
                  </button>
                </div>

                <div class="settings-list">
                  {/* SHARE */}
                  <button
                    type="button"
                    class="settings-item"
                    onClick={handleShare}
                  >
                    <iconify-icon
                      icon="lucide:share-2"
                      width="18"
                      height="18"
                    />

                    <span>
                      Share
                    </span>
                  </button>

                  {/* EXTENSIONS */}
                  <button
                    type="button"
                    class="settings-item"
                    onClick={() => {
                      setActivePanel(
                        'extensions'
                      );
                      setIsSidebarOpen(true);
                    }}
                  >
                    <iconify-icon
                      icon="lucide:blocks"
                      width="18"
                      height="18"
                    />

                    <span>
                      Extensions
                    </span>

                    <span class="settings-count">
                      {extensions.filter(
                        (item) =>
                          item.installed
                      ).length}
                    </span>
                  </button>

                  {/* KEYBOARD SHORTCUTS */}
                  <button
                    type="button"
                    class="settings-item"
                    onClick={() =>
                      setIsShortcutsOpen(true)
                    }
                  >
                    <iconify-icon
                      icon="lucide:keyboard"
                      width="18"
                      height="18"
                    />

                    <span>
                      Keyboard Shortcuts
                    </span>
                  </button>

                  {/* THEME */}
                  <div class="settings-section">
                    <div class="settings-section-title">
                      <iconify-icon
                        icon="lucide:palette"
                        width="16"
                        height="16"
                      />

                      <span>
                        Theme
                      </span>
                    </div>

                    <div class="theme-grid">
                      {themes.map(
                        (item) => (
                          <button
                            key={item.id}
                            type="button"
                            class={`theme-option ${
                              theme ===
                              item.id
                                ? 'selected'
                                : ''
                            }`}
                            onClick={() =>
                              handleThemeChange(
                                item.id
                              )
                            }
                          >
                            <div class="theme-option-icon">
                              <iconify-icon
                                icon={
                                  item.icon
                                }
                                width="17"
                                height="17"
                              />
                            </div>

                            <div>
                              <strong>
                                {item.name}
                              </strong>

                              <span>
                                {
                                  item.description
                                }
                              </span>
                            </div>

                            {theme ===
                              item.id && (
                              <iconify-icon
                                icon="lucide:check"
                                width="15"
                                height="15"
                              />
                            )}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* FONT SIZE */}
                  <div class="settings-section">
                    <div class="settings-section-title">
                      <iconify-icon
                        icon="lucide:type"
                        width="16"
                        height="16"
                      />

                      <span>
                        Font Size
                      </span>

                      <strong class="font-size-value">
                        {fontSize}px
                      </strong>
                    </div>

                    <div class="font-size-options">
                      {fontSizes.map(
                        (size) => (
                          <button
                            key={size}
                            type="button"
                            class={
                              fontSize ===
                              size
                                ? 'selected'
                                : ''
                            }
                            onClick={() =>
                              handleFontSizeChange(
                                size
                              )
                            }
                          >
                            {size}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* AUTO SAVE */}
                  <button
                    type="button"
                    class="settings-item"
                    onClick={
                      handleAutoSaveToggle
                    }
                  >
                    <iconify-icon
                      icon="lucide:save"
                      width="18"
                      height="18"
                    />

                    <span>
                      Auto Save
                    </span>

                    <span
                      class={`settings-toggle ${
                        isAutoSave
                          ? 'on'
                          : ''
                      }`}
                    >
                      {isAutoSave
                        ? 'ON'
                        : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}

        <section
          class="editor-pane"
          aria-label="Editor"
        >
          <TabBar />

          {activeTab.value ? (
            <>
              <EditorToolbar
                tab={activeTab.value}
              />

              <Editor
                key={activeTab.value.path}
                tab={activeTab.value}
              />
            </>
          ) : (
            <div class="welcome">
              <div class="welcome-icon">
                ⌘
              </div>

              <h1>
                Ready when you are.
              </h1>

              <p>
                Choose a file from the explorer
                or create a new one.
              </p>

              <button
                type="button"
                onClick={handleNewFile}
              >
                Create a file
              </button>
            </div>
          )}
        </section>
      </div>

      {/* KEYBOARD SHORTCUTS MODAL */}
      {isShortcutsOpen && (
        <div
          class="shortcuts-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setIsShortcutsOpen(false);
            }
          }}
        >
          <div
            class="shortcuts-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard Shortcuts"
          >
            <div class="shortcuts-header">
              <div>
                <div class="shortcuts-title">
                  <iconify-icon
                    icon="lucide:keyboard"
                    width="19"
                    height="19"
                  />

                  <span>
                    Keyboard Shortcuts
                  </span>
                </div>

                <p>
                  All available SwiftEdit shortcuts
                </p>
              </div>

              <button
                type="button"
                title="Close"
                aria-label="Close Keyboard Shortcuts"
                onClick={() =>
                  setIsShortcutsOpen(false)
                }
              >
                <iconify-icon
                  icon="lucide:x"
                  width="18"
                  height="18"
                />
              </button>
            </div>

            <div class="shortcuts-content">
              {keyboardShortcuts.map(
                (group) => (
                  <div
                    key={group.category}
                    class="shortcut-group"
                  >
                    <h3>
                      {group.category}
                    </h3>

                    {group.items.map(
                      (item) => (
                        <div
                          key={
                            item.action
                          }
                          class="shortcut-row"
                        >
                          <span>
                            {item.action}
                          </span>

                          <kbd>
                            {
                              item.shortcut
                            }
                          </kbd>
                        </div>
                      )
                    )}
                  </div>
                )
              )}
            </div>

            <div class="shortcuts-footer">
              <span>
                Tip: On macOS, Ctrl means Command (⌘).
              </span>

              <button
                type="button"
                onClick={() =>
                  setIsShortcutsOpen(false)
                }
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {isBottomPanelOpen && (
        <section
          class="bottom-panel"
          aria-label="Bottom Panel"
        >
          <div class="bottom-panel-header">
            <div class="bottom-panel-tabs">
              <button
                type="button"
                class={`bottom-panel-tab ${
                  bottomPanel ===
                  'terminal'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setBottomPanel(
                    'terminal'
                  )
                }
              >
                <iconify-icon
                  icon="lucide:terminal"
                  width="14"
                  height="14"
                />
                TERMINAL
              </button>

              <button
                type="button"
                class={`bottom-panel-tab ${
                  bottomPanel ===
                  'output'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setBottomPanel(
                    'output'
                  )
                }
              >
                <iconify-icon
                  icon="lucide:panel-bottom"
                  width="14"
                  height="14"
                />
                OUTPUT
              </button>

              <button
                type="button"
                class={`bottom-panel-tab ${
                  bottomPanel ===
                  'debug-console'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setBottomPanel(
                    'debug-console'
                  )
                }
              >
                <iconify-icon
                  icon="lucide:bug"
                  width="14"
                  height="14"
                />
                DEBUG CONSOLE
              </button>
            </div>

            <div class="bottom-panel-actions">
              <button
                type="button"
                title="Clear"
                onClick={() => {
                  if (
                    bottomPanel ===
                    'output'
                  ) {
                    setOutputMessage(
                      'No output yet.'
                    );
                  }
                }}
              >
                <iconify-icon
                  icon="lucide:trash-2"
                  width="14"
                  height="14"
                />
              </button>

              <button
                type="button"
                title="Close Panel"
                aria-label="Close Bottom Panel"
                onClick={
                  closeBottomPanel
                }
              >
                <iconify-icon
                  icon="lucide:x"
                  width="16"
                  height="16"
                />
              </button>
            </div>
          </div>

          {bottomPanel ===
            'terminal' && (
            <div class="terminal-content">
              <div class="terminal-line">
                <span class="terminal-prompt">
                  $
                </span>

                <span>
                  SwiftEdit terminal
                </span>
              </div>

              <div class="terminal-line terminal-muted">
                Terminal is ready.
              </div>

              <div class="terminal-line terminal-input-line">
                <span class="terminal-prompt">
                  $
                </span>

                <span class="terminal-cursor" />
              </div>
            </div>
          )}

          {bottomPanel ===
            'output' && (
            <div class="output-content">
              <div class="output-line">
                <span class="output-status-dot" />

                <span>
                  {outputMessage}
                </span>
              </div>
            </div>
          )}

          {bottomPanel ===
            'debug-console' && (
            <div class="output-content">
              <div class="output-line">
                <span class="output-status-dot" />

                <span>
                  Debug Console is ready.
                </span>
              </div>

              <div class="terminal-line terminal-muted">
                No debug session is currently active.
              </div>
            </div>
          )}
        </section>
      )}

      <footer class="statusbar">
        <span>
          {message.value ||
            'Ready'}
        </span>

        <span>
          {language !==
          'Select Language'
            ? language
            : 'Plain Text'}

          {' · '}

          UTF-8 ·{' '}

          {isAutoSave
            ? 'Auto Save ON'
            : 'Auto Save OFF'}

          {' · '}

          {fontSize}px ·{' '}

          Ctrl/Cmd+S to save
        </span>
      </footer>
    </div>
  );
}