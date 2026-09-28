import { useEffect, useRef, useState } from 'preact/hooks';
import {
  activePath,
  closeTab,
  tabs,
  type Tab,
} from './state';

import 'iconify-icon';

// ==============================
// COMMANDS
// ==============================

const commands = [
  {
    id: 'split-right',
    label: 'Split Right',
    description: 'Split the editor to the right',
    icon: 'lucide:columns-2',
  },
  {
    id: 'split-down',
    label: 'Split Down',
    description: 'Split the editor downward',
    icon: 'lucide:rows-2',
  },
  {
    id: 'close-split',
    label: 'Close Split',
    description: 'Close the current split pane',
    icon: 'lucide:panel-top-close',
  },
  {
    id: 'focus-explorer',
    label: 'Focus Explorer',
    description: 'Focus the file explorer',
    icon: 'lucide:files',
  },
  {
    id: 'search-files',
    label: 'Quick Open',
    description: 'Search and open project files',
    icon: 'lucide:search',
  },
  {
    id: 'change-language',
    label: 'Change Language',
    description: 'Change the editor language',
    icon: 'lucide:code-2',
  },
  {
    id: 'settings',
    label: 'Open Settings',
    description: 'Open editor settings',
    icon: 'lucide:settings',
  },
  {
    id: 'run',
    label: 'Run Code',
    description: 'Run the current project',
    icon: 'lucide:play',
  },
];

// ==============================
// COMMAND PALETTE
// ==============================

function CommandPalette({
  isOpen,
  onClose,
  onCommand,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (commandId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = commands.filter((command) => {
    const searchText =
      `${command.label} ${command.description}`.toLowerCase();

    return searchText.includes(query.toLowerCase());
  });

  // Focus input when palette opens
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, [isOpen]);

  // Reset selected item when searching
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function executeCommand(
    command: (typeof commands)[number] | undefined
  ) {
    if (!command) return;

    onCommand(command.id);
    onClose();
  }

  function handleKeyDown(event: KeyboardEvent) {
    // ESC
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();

      onClose();
      return;
    }

    // Arrow Down
    if (event.key === 'ArrowDown') {
      event.preventDefault();

      setSelectedIndex((current) =>
        Math.min(
          current + 1,
          Math.max(
            filteredCommands.length - 1,
            0
          )
        )
      );

      return;
    }

    // Arrow Up
    if (event.key === 'ArrowUp') {
      event.preventDefault();

      setSelectedIndex((current) =>
        Math.max(current - 1, 0)
      );

      return;
    }

    // Enter
    if (event.key === 'Enter') {
      event.preventDefault();

      executeCommand(
        filteredCommands[selectedIndex]
      );
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      class="command-palette-overlay"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        class="command-palette"
        role="dialog"
        aria-label="Command Palette"
      >
        {/* INPUT */}
        <div class="command-palette-input">
          <iconify-icon
            icon="lucide:terminal"
            width="17"
            height="17"
            aria-hidden="true"
          />

          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Type a command..."
            onInput={(event) =>
              setQuery(
                event.currentTarget.value
              )
            }
            onKeyDown={handleKeyDown}
          />

          <span class="command-palette-shortcut">
            ESC
          </span>
        </div>

        {/* RESULTS */}
        <div class="command-palette-results">
          {filteredCommands.length === 0 ? (
            <div class="command-palette-empty">
              <iconify-icon
                icon="lucide:search-x"
                width="18"
                height="18"
              />

              <span>
                No commands found
              </span>
            </div>
          ) : (
            filteredCommands.map(
              (command, index) => (
                <button
                  type="button"
                  key={command.id}
                  class={
                    index === selectedIndex
                      ? 'command-item selected'
                      : 'command-item'
                  }
                  onMouseEnter={() =>
                    setSelectedIndex(index)
                  }
                  onClick={() =>
                    executeCommand(command)
                  }
                >
                  <span class="command-icon">
                    <iconify-icon
                      icon={command.icon}
                      width="16"
                      height="16"
                      aria-hidden="true"
                    />
                  </span>

                  <span class="command-content">
                    <span class="command-label">
                      {command.label}
                    </span>

                    <span class="command-description">
                      {command.description}
                    </span>
                  </span>

                  {index === selectedIndex && (
                    <span class="command-enter">
                      Enter
                    </span>
                  )}
                </button>
              )
            )
          )}
        </div>

        {/* FOOTER */}
        <div class="command-palette-footer">
          <span>
            ↑↓ Navigate
          </span>

          <span>
            Enter Run
          </span>

          <span>
            Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}

// ==============================
// TAB BUTTON
// ==============================

function TabButton({
  tab,
}: {
  tab: Tab;
}) {
  const isActive =
    activePath.value === tab.path;

  const dirty =
    tab.content.value !==
    tab.savedContent.value;

  return (
    <div
      class={`tab ${
        isActive ? 'active' : ''
      }`}
    >
      {/* FILE NAME */}
      <button
        role="tab"
        aria-selected={isActive}
        onClick={() => {
          activePath.value = tab.path;
        }}
      >
        {tab.path.split('/').pop()}
        {dirty ? ' ●' : ''}
      </button>

      {/* CLOSE FILE */}
      <button
        type="button"
        class="tab-close"
        aria-label={`Close ${tab.path}`}
        title={`Close ${tab.path}`}
        onClick={(event) => {
          event.stopPropagation();
          closeTab(tab.path);
        }}
      >
        ×
      </button>
    </div>
  );
}

// ==============================
// WELCOME TAB
// ==============================

function WelcomeTab({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div class="tab active">
      {/* WELCOME */}
      <button
        type="button"
        role="tab"
        aria-selected="true"
        onClick={() => undefined}
      >
        Welcome
      </button>

      {/* CLOSE WELCOME */}
      <button
        type="button"
        class="tab-close"
        aria-label="Close Welcome"
        title="Close Welcome"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        ×
      </button>
    </div>
  );
}

// ==============================
// TAB BAR
// ==============================

export function TabBar() {
  const [
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
  ] = useState(false);

  const [
    isWelcomeOpen,
    setIsWelcomeOpen,
  ] = useState(true);

  // Ctrl + Shift + P
  useEffect(() => {
    function handleGlobalKeyDown(
      event: KeyboardEvent
    ) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'p'
      ) {
        event.preventDefault();

        setIsCommandPaletteOpen(true);
      }
    }

    window.addEventListener(
      'keydown',
      handleGlobalKeyDown
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleGlobalKeyDown
      );
    };
  }, []);

  // When a file is opened,
  // make sure Welcome can appear again
  useEffect(() => {
    if (tabs.value.length > 0) {
      setIsWelcomeOpen(true);
    }
  }, [tabs.value.length]);

  function handleCommand(
    commandId: string
  ) {
    console.log(
      'Command:',
      commandId
    );

    // هنا بعدين نقدر نربط كل Command
    // بالوظيفة الحقيقية بتاعته.

    switch (commandId) {
      case 'split-right':
        console.log('Split Right');
        break;

      case 'split-down':
        console.log('Split Down');
        break;

      case 'close-split':
        console.log('Close Split');
        break;

      case 'focus-explorer':
        console.log('Focus Explorer');
        break;

      case 'search-files':
        console.log('Quick Open');
        break;

      case 'change-language':
        console.log('Change Language');
        break;

      case 'settings':
        console.log('Open Settings');
        break;

      case 'run':
        console.log('Run Code');
        break;

      default:
        break;
    }
  }

  return (
    <>
      {/* TABS */}
      <div
        class="tabs"
        role="tablist"
      >
        {tabs.value.length > 0 ? (
          tabs.value.map((tab) => (
            <TabButton
              key={tab.path}
              tab={tab}
            />
          ))
        ) : (
          isWelcomeOpen && (
            <WelcomeTab
              onClose={() =>
                setIsWelcomeOpen(false)
              }
            />
          )
        )}

        <div
          class="tab-layout-actions"
          aria-label="Editor layout"
        >
          <button
            type="button"
            title="Split editor to the right"
            onClick={() =>
              handleCommand('split-right')
            }
          >
            <iconify-icon
              icon="lucide:columns-2"
              width="14"
              height="14"
              aria-hidden="true"
            />

            <span>
              Split Right
            </span>
          </button>

          <button
            type="button"
            title="Split editor downward"
            onClick={() =>
              handleCommand('split-down')
            }
          >
            <iconify-icon
              icon="lucide:rows-2"
              width="14"
              height="14"
              aria-hidden="true"
            />

            <span>
              Split Down
            </span>
          </button>
        </div>
      </div>

      {/* COMMAND PALETTE */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() =>
          setIsCommandPaletteOpen(false)
        }
        onCommand={handleCommand}
      />
    </>
  );
}