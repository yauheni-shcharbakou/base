import type { BrowserStorage } from '@packages/proto';

type TreeFolder = Pick<
  BrowserStorage.StorageObjectPopulated,
  'id' | 'name' | 'parentId' | 'folderPath'
>;

/** An owner's folders, as the flat list `getFolders` returns, walkable as the tree they are. */
export type FolderTree<T extends TreeFolder = TreeFolder> = {
  root?: T;
  byId: Map<string, T>;
  // Each folder's subfolders, in natural order by name. The root is under `undefined`.
  childrenOf: Map<string | undefined, T[]>;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const compareFolderNames = (a: TreeFolder, b: TreeFolder) =>
  collator.compare(a.name, b.name);

export const toFolderTree = <T extends TreeFolder>(folders: T[]): FolderTree<T> => {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const childrenOf = new Map<string | undefined, T[]>();

  folders.forEach((folder) => {
    const siblings = childrenOf.get(folder.parentId) ?? [];
    siblings.push(folder);
    childrenOf.set(folder.parentId, siblings);
  });
  childrenOf.forEach((siblings) => siblings.sort(compareFolderNames));

  return { root: folders.find((folder) => !folder.parentId), byId, childrenOf };
};

/** The folders from the root down to `id`, both included. Empty for a folder the tree lacks. */
export const getFolderTrail = <T extends TreeFolder>(tree: FolderTree<T>, id?: string): T[] => {
  const trail: T[] = [];
  const visited = new Set<string>();

  for (let folder = id ? tree.byId.get(id) : undefined; folder && !visited.has(folder.id);) {
    visited.add(folder.id);
    trail.unshift(folder);
    folder = folder.parentId ? tree.byId.get(folder.parentId) : undefined;
  }

  return trail;
};

/**
 * The folders nothing may go into: `ids` and every folder under them — a folder moved into its own
 * subtree would leave the root behind.
 */
export const getBlockedFolderIds = (tree: FolderTree, ids: string[]): Set<string> => {
  const blocked = new Set<string>();
  const queue = ids.filter((id) => tree.byId.has(id));

  while (queue.length) {
    const id = queue.pop() as string;

    if (!blocked.has(id)) {
      blocked.add(id);
      tree.childrenOf.get(id)?.forEach((child) => queue.push(child.id));
    }
  }

  return blocked;
};

/** The folders whose name holds `query`, in any case, ordered by path. None for a blank query. */
export const searchFolders = <T extends TreeFolder>(folders: T[], query: string): T[] => {
  const needle = query.trim().toLocaleLowerCase();

  if (!needle) {
    return [];
  }

  return folders
    .filter((folder) => folder.parentId && folder.name.toLocaleLowerCase().includes(needle))
    .sort((a, b) => collator.compare(a.folderPath ?? '', b.folderPath ?? ''));
};

/** A folder as a field shows it: its path, and the owner's root by the name given to it. */
export const getFolderLabel = (folder: TreeFolder, rootLabel: string): string =>
  folder.parentId ? (folder.folderPath ?? folder.name).replace(/\/$/, '') : rootLabel;
