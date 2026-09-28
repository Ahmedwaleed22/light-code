import { computed, signal, type Signal } from '@preact/signals';

import {
  createFile,
  createDirectory,
  listFiles,
  readFile,
  saveFile,
  type Entry
} from './api';

export type Tab = {
  path: string;
  content: Signal<string>;
  savedContent: Signal<string>;
  version: string;
  saving: Signal<boolean>;
};

export const entries = signal<Entry[]>([]);
export const tabs = signal<Tab[]>([]);
export const activePath = signal<string | null>(null);

export const activeTab = computed(
  () =>
    tabs.value.find(
      (tab) => tab.path === activePath.value
    ) ?? null
);

export const message = signal('');

export async function refreshFiles() {
  try {
    entries.value = await listFiles();
  } catch (error) {
    message.value = String(error);
  }
}

export async function openFile(path: string) {
  const existingTab = tabs.value.find(
    (tab) => tab.path === path
  );

  if (existingTab) {
    activePath.value = path;
    message.value = '';
    return;
  }

  try {
    const doc = await readFile(path);

    tabs.value = [
      ...tabs.value,
      {
        path,
        content: signal(doc.content),
        savedContent: signal(doc.content),
        version: doc.version,
        saving: signal(false)
      }
    ];

    activePath.value = path;
    message.value = '';
  } catch (error) {
    message.value = String(error);
  }
}

export function closeTab(path: string) {
  const tab = tabs.value.find(
    (item) => item.path === path
  );

  if (
    tab &&
    tab.content.value !== tab.savedContent.value &&
    !window.confirm(
      `Discard unsaved changes to ${path}?`
    )
  ) {
    return;
  }

  const index = tabs.value.findIndex(
    (item) => item.path === path
  );

  tabs.value = tabs.value.filter(
    (item) => item.path !== path
  );

  if (activePath.value === path) {
    activePath.value =
      tabs.value[
        Math.max(0, index - 1)
      ]?.path ?? null;
  }

  message.value = '';
}

export async function saveTab(tab: Tab) {
  if (tab.saving.value) {
    return;
  }

  if (
    tab.content.value ===
    tab.savedContent.value
  ) {
    message.value = `Saved ${tab.path}`;
    return;
  }

  tab.saving.value = true;

  const content =
    tab.content.value;

  try {
    const doc = await saveFile({
      path: tab.path,
      content,
      version: tab.version
    });

    tab.version = doc.version;
    tab.savedContent.value = content;

    message.value =
      `Saved ${tab.path}`;
  } catch (error) {
    message.value =
      `Could not save ${tab.path}: ${String(error)}`;
  } finally {
    tab.saving.value = false;
  }
}

export async function saveAsTab(
  tab: Tab,
  newPath: string
) {
  const path = newPath.trim();

  if (!path) {
    return;
  }

  if (path === tab.path) {
    await saveTab(tab);
    return;
  }

  const existing = entries.value.find(
    (entry) =>
      entry.path.toLowerCase() ===
      path.toLowerCase()
  );

  if (existing) {
    message.value =
      `A file named "${path}" already exists.`;

    return;
  }

  try {
    await createFile(path);

    const newDoc =
      await readFile(path);

    const saved =
      await saveFile({
        path,
        content: tab.content.value,
        version: newDoc.version
      });

    const newTab: Tab = {
      path,
      content: signal(
        tab.content.value
      ),
      savedContent: signal(
        tab.content.value
      ),
      version: saved.version,
      saving: signal(false)
    };

    tabs.value = [
      ...tabs.value,
      newTab
    ];

    activePath.value = path;

    await refreshFiles();

    message.value =
      `Saved as ${path}`;
  } catch (error) {
    message.value =
      `Could not save as ${path}: ${String(error)}`;

    await refreshFiles();
  }
}

export async function newFile(
  filePath?: string
) {
  const path = (
    filePath ??
    window.prompt(
      'New file path (relative to workspace):'
    )
  )?.trim();

  if (!path) {
    return;
  }

  try {
    const existing = entries.value.find(
      (entry) =>
        entry.path.toLowerCase() ===
        path.toLowerCase()
    );

    if (existing) {
      message.value =
        `A file or folder named "${path}" already exists.`;

      return;
    }

    await createFile(path);

    await refreshFiles();

    await openFile(path);

    message.value =
      `Created ${path}`;
  } catch (error) {
    message.value = String(error);

    await refreshFiles();
  }
}

export async function newFolder(
  folderPath?: string
) {
  const path = (
    folderPath ??
    window.prompt(
      'New folder path (relative to workspace):'
    )
  )?.trim();

  if (!path) {
    return;
  }

  try {
    const existing = entries.value.find(
      (entry) =>
        entry.path.toLowerCase() ===
        path.toLowerCase()
    );

    if (existing) {
      message.value =
        `A file or folder named "${path}" already exists.`;

      return;
    }

    await createDirectory(path);

    await refreshFiles();

    message.value =
      `Created folder ${path}`;
  } catch (error) {
    message.value = String(error);

    await refreshFiles();
  }
}

export async function importLocalFiles(
  files: File[]
) {
  if (files.length === 0) {
    return;
  }

  try {
    const existing = new Map(
      entries.value.map(
        (entry) => [
          entry.path,
          entry.kind
        ]
      )
    );

    const directories =
      new Set<string>();

    const imports: Array<{
      path: string;
      content: string;
    }> = [];

    for (const file of files) {
      const relativePath =
        (
          file as File & {
            webkitRelativePath?: string;
          }
        ).webkitRelativePath ||
        file.name;

      const path =
        relativePath
          .replace(/\\/g, '/')
          .replace(/^\/+/, '');

      const parts =
        path.split('/');

      if (
        parts.some(
          (part) =>
            !part ||
            part === '.' ||
            part === '..'
        )
      ) {
        continue;
      }

      for (
        let index = 1;
        index < parts.length;
        index += 1
      ) {
        directories.add(
          parts
            .slice(0, index)
            .join('/')
        );
      }

      if (
        file.size >
        2 * 1024 * 1024
      ) {
        throw new Error(
          `${path} exceeds the 2 MiB file limit.`
        );
      }

      imports.push({
        path,
        content:
          await file.text()
      });
    }

    for (
      const directory of [
        ...directories
      ].sort(
        (a, b) =>
          a.split('/').length -
          b.split('/').length
      )
    ) {
      if (!existing.has(directory)) {
        await createDirectory(
          directory
        );

        existing.set(
          directory,
          'directory'
        );
      }
    }

    let imported = 0;

    for (
      const file of imports
    ) {
      if (
        existing.has(file.path)
      ) {
        continue;
      }

      await createFile(
        file.path
      );

      const doc =
        await readFile(
          file.path
        );

      await saveFile({
        ...doc,
        content:
          file.content
      });

      existing.set(
        file.path,
        'file'
      );

      imported += 1;
    }

    await refreshFiles();

    const firstImported =
      imports.find(
        (file) =>
          existing.get(
            file.path
          ) === 'file'
      );

    if (firstImported) {
      await openFile(
        firstImported.path
      );
    }

    message.value =
      `Imported ${imported} file${
        imported === 1
          ? ''
          : 's'
      } into the workspace`;
  } catch (error) {
    message.value =
      `Could not import files: ${String(error)}`;

    await refreshFiles();
  }
}