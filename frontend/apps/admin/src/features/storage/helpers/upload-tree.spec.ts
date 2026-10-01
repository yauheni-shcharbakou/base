import {
  collectFolderPaths,
  readDirectoryInput,
  readDroppedTree,
  type DroppedEntry,
} from './upload-tree';

const fileOf = (name: string, relativePath = '') =>
  Object.defineProperty(new File(['x'], name), 'webkitRelativePath', { value: relativePath });

// The entries API as a drop hands it over: `readEntries` answers a page at a time, then nothing.
const fileEntry = (file: File) => ({
  name: file.name,
  isFile: true,
  isDirectory: false,
  file: (resolve: (file: File) => void) => resolve(file),
});

const directoryEntry = (name: string, children: unknown[]) => {
  const pages = [children.slice(0, 1), children.slice(1), []];

  return {
    name,
    isFile: false,
    isDirectory: true,
    createReader: () => ({
      readEntries: (resolve: (entries: unknown[]) => void) => resolve(pages.shift() ?? []),
    }),
  };
};

const itemOf = (entry: unknown, file: File | null = null) => ({
  kind: 'file',
  getAsFile: () => file,
  webkitGetAsEntry: () => entry,
});

const summarize = ({ entries, folders }: { entries: DroppedEntry[]; folders: string[] }) => ({
  entries: entries.map(({ file, path }) => `${path}|${file.name}`),
  folders,
});

describe('collectFolderPaths', () => {
  it('lists every folder once, after its parent', () => {
    const entries = [
      { file: fileOf('a'), path: 'img/2024/may' },
      { file: fileOf('b'), path: 'img' },
      { file: fileOf('c'), path: '' },
    ];

    expect(collectFolderPaths(entries, ['docs', 'img/empty'])).toEqual([
      'docs',
      'img',
      'img/empty',
      'img/2024',
      'img/2024/may',
    ]);
  });
});

describe('readDirectoryInput', () => {
  it('puts each file in the folder of its relative path, leaving system files out', () => {
    const tree = readDirectoryInput([
      fileOf('a.jpg', 'img/a.jpg'),
      fileOf('b.jpg', 'img/2024/b.jpg'),
      fileOf('.DS_Store', 'img/.DS_Store'),
    ]);

    expect(summarize(tree)).toEqual({
      entries: ['img|a.jpg', 'img/2024|b.jpg'],
      folders: ['img', 'img/2024'],
    });
  });
});

describe('readDroppedTree', () => {
  it('walks every dropped folder, page by page, beside the files dropped with it', async () => {
    const loose = fileOf('loose.txt');
    const tree = await readDroppedTree({
      items: [
        itemOf(
          directoryEntry('img', [
            fileEntry(fileOf('a.jpg')),
            directoryEntry('2024', [fileEntry(fileOf('b.jpg'))]),
            directoryEntry('empty', []),
            fileEntry(fileOf('Thumbs.db')),
          ]),
        ),
        itemOf(fileEntry(loose), loose),
      ] as unknown as DataTransferItemList,
      files: [] as unknown as FileList,
    });

    expect(summarize(tree)).toEqual({
      entries: ['img|a.jpg', 'img/2024|b.jpg', '|loose.txt'],
      folders: ['img', 'img/2024', 'img/empty'],
    });
  });

  it('falls back on the file list without items', async () => {
    const file = fileOf('a.txt');
    const tree = await readDroppedTree({
      items: [] as unknown as DataTransferItemList,
      files: [file] as unknown as FileList,
    });

    expect(tree).toEqual({ entries: [{ file, path: '' }], folders: [] });
  });
});
