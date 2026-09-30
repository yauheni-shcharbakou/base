// An uploaded directory as the folder browser reads it: from a drop, whose folders are walked
// through the entries API, or from a directory picker (`<input webkitdirectory>`), whose files carry
// their `webkitRelativePath`. Either way, each file comes with the folder it goes into, relative to
// the folder it was dropped on.

const SEPARATOR = '/';

/** Folders one upload may make — the gateway's cap on one `createFolders` call. */
export const MAX_TREE_FOLDERS = 500;

// What a file manager leaves in every folder it opened. Never what anybody meant to upload.
const SYSTEM_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

export const isSystemFile = (name: string) => SYSTEM_FILES.has(name);

export type DroppedEntry = {
  file: File;
  // The folder the file goes into, relative to the target: '' for the target itself.
  path: string;
};

export type DroppedTree = {
  entries: DroppedEntry[];
  // Every folder to make, parents before their children, empty ones included.
  folders: string[];
};

const getParentPath = (path: string) => path.split(SEPARATOR).slice(0, -1).join(SEPARATOR);

/**
 * The folders a tree needs, each listed once and after its parent: those read as folders (empty
 * ones included) and those the files' paths go through.
 */
export const collectFolderPaths = (entries: DroppedEntry[], folders: string[] = []): string[] => {
  const collected = new Set<string>();

  const add = (path: string) => {
    if (!path || collected.has(path)) {
      return;
    }

    add(getParentPath(path));
    collected.add(path);
  };

  folders.forEach(add);
  entries.forEach(({ path }) => add(path));

  return Array.from(collected);
};

const buildTree = (entries: DroppedEntry[], folders: string[] = []): DroppedTree => {
  const kept = entries.filter(({ file }) => !isSystemFile(file.name));
  return { entries: kept, folders: collectFolderPaths(kept, folders) };
};

/** The tree a directory picker chose: each file's folder is its relative path, less its name. */
export const readDirectoryInput = (files: File[]): DroppedTree =>
  buildTree(files.map((file) => ({ file, path: getParentPath(file.webkitRelativePath) })));

// `readEntries` answers a page at a time — about a hundred in Chrome — and an empty page at the end.
const readAllEntries = async (directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> => {
  const reader = directory.createReader();
  const entries: FileSystemEntry[] = [];

  for (;;) {
    const page = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );

    if (!page.length) {
      return entries;
    }

    entries.push(...page);
  }
};

const readFile = (entry: FileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => entry.file(resolve, reject));

const walkDirectory = async (
  directory: FileSystemDirectoryEntry,
  path: string,
  tree: { entries: DroppedEntry[]; folders: string[] },
): Promise<void> => {
  tree.folders.push(path);

  for (const entry of await readAllEntries(directory)) {
    if (entry.isDirectory) {
      await walkDirectory(entry as FileSystemDirectoryEntry, `${path}/${entry.name}`, tree);
    } else if (entry.isFile) {
      tree.entries.push({ file: await readFile(entry as FileSystemFileEntry), path });
    }
  }
};

/**
 * Reads a drop: its files, and every folder in it walked down to the last file. Call it from the
 * drop event: the items are read then — the list is emptied once the event returns — and only the
 * walk goes on after it.
 */
export const readDroppedTree = (
  dataTransfer: Pick<DataTransfer, 'items' | 'files'>,
): Promise<DroppedTree> => {
  const items = Array.from(dataTransfer.items ?? []).filter(({ kind }) => kind === 'file');

  if (!items.length) {
    const files = Array.from(dataTransfer.files ?? []);
    return Promise.resolve(buildTree(files.map((file) => ({ file, path: '' }))));
  }

  // Synchronously, both: neither answers once the event has returned.
  const dropped = items.map((item) => ({
    entry: item.webkitGetAsEntry?.(),
    file: item.getAsFile(),
  }));

  return (async () => {
    const tree = { entries: [] as DroppedEntry[], folders: [] as string[] };

    for (const { entry, file } of dropped) {
      if (entry?.isDirectory) {
        await walkDirectory(entry as FileSystemDirectoryEntry, entry.name, tree);
      } else if (file) {
        tree.entries.push({ file, path: '' });
      }
    }

    return buildTree(tree.entries, tree.folders);
  })();
};
