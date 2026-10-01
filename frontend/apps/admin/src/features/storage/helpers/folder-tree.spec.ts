import {
  getBlockedFolderIds,
  getFolderLabel,
  getFolderTrail,
  searchFolders,
  stepFolderPick,
  toFolderTree,
} from './folder-tree';

const folder = (id: string, name: string, parentId?: string, folderPath?: string) => ({
  id,
  name,
  parentId,
  folderPath,
});

// root ─┬─ docs ─── v10
//       │       └── v2
//       └─ Photos ── 2024
const folders = [
  folder('root', '', undefined, '/'),
  folder('docs', 'docs', 'root', '/docs/'),
  folder('photos', 'Photos', 'root', '/Photos/'),
  folder('v10', 'v10', 'docs', '/docs/v10/'),
  folder('v2', 'v2', 'docs', '/docs/v2/'),
  folder('2024', '2024', 'photos', '/Photos/2024/'),
];

const tree = toFolderTree(folders);

describe('toFolderTree', () => {
  it('finds the root and lists each folder’s subfolders in natural order', () => {
    expect(tree.root?.id).toBe('root');
    expect(tree.childrenOf.get('root')?.map(({ id }) => id)).toEqual(['docs', 'photos']);
    expect(tree.childrenOf.get('docs')?.map(({ id }) => id)).toEqual(['v2', 'v10']);
    expect(tree.childrenOf.get('v2')).toBeUndefined();
  });
});

describe('getFolderTrail', () => {
  it('goes from the root down to the folder', () => {
    expect(getFolderTrail(tree, 'v10').map(({ id }) => id)).toEqual(['root', 'docs', 'v10']);
  });

  it('is empty for a folder the tree lacks', () => {
    expect(getFolderTrail(tree, 'gone')).toEqual([]);
    expect(getFolderTrail(tree)).toEqual([]);
  });
});

describe('getBlockedFolderIds', () => {
  it('blocks the folders and everything under them', () => {
    expect(Array.from(getBlockedFolderIds(tree, ['docs'])).sort()).toEqual(['docs', 'v10', 'v2']);
  });

  it('ignores an id that is no folder of the tree — a file', () => {
    expect(getBlockedFolderIds(tree, ['file']).size).toBe(0);
  });
});

describe('searchFolders', () => {
  it('matches names in any case, ordered by path, never the root', () => {
    expect(searchFolders(folders, 'V').map(({ id }) => id)).toEqual(['v2', 'v10']);
    expect(searchFolders(folders, 'photo').map(({ id }) => id)).toEqual(['photos']);
  });

  it('finds nothing for a blank query', () => {
    expect(searchFolders(folders, '  ')).toEqual([]);
  });
});

describe('getFolderLabel', () => {
  it('shows a path, and the root by its given name', () => {
    expect(getFolderLabel(folders[3], 'Root')).toBe('/docs/v10');
    expect(getFolderLabel(folders[0], 'Root')).toBe('Root');
  });
});

describe('stepFolderPick', () => {
  const ids = ['a', 'b', 'c'];

  it('steps down and up, and holds at the ends', () => {
    expect(stepFolderPick(ids, 'a', 1)).toBe('b');
    expect(stepFolderPick(ids, 'b', -1)).toBe('a');
    expect(stepFolderPick(ids, 'c', 1)).toBe('c');
    expect(stepFolderPick(ids, 'a', -1)).toBe('a');
  });

  it('starts from an end with nothing picked, or a pick the list lacks', () => {
    expect(stepFolderPick(ids, undefined, 1)).toBe('a');
    expect(stepFolderPick(ids, 'gone', -1)).toBe('c');
    expect(stepFolderPick([], undefined, 1)).toBeUndefined();
  });
});
