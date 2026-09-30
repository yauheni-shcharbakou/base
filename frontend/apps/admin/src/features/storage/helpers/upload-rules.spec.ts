import { BrowserStorage } from '@packages/proto';
import { getUploadKind, readDroppedFiles, sortUploads, toDropzoneAccept } from './upload-rules';

const { FILE, IMAGE, VIDEO } = BrowserStorage.StorageObjectType;

const fileOf = (name: string, type: string, size = 1) =>
  new File([new Uint8Array(size)], name, { type });

describe('getUploadKind', () => {
  it('takes an image or a video its form takes, and keeps anything else a file', () => {
    expect(getUploadKind(fileOf('a.png', 'image/png'))).toBe(IMAGE);
    expect(getUploadKind(fileOf('a.mov', 'video/quicktime'))).toBe(VIDEO);
    expect(getUploadKind(fileOf('a.heic', 'image/heic'))).toBe(FILE);
    expect(getUploadKind(fileOf('a.mkv', 'video/x-matroska'))).toBe(FILE);
    expect(getUploadKind(fileOf('Makefile', ''))).toBe(FILE);
  });
});

describe('sortUploads', () => {
  it('refuses an empty file and one over its kind’s limit', () => {
    const big = fileOf('big.png', 'image/png');
    Object.defineProperty(big, 'size', { value: 101 * 1024 * 1024 });

    const { accepted, rejected } = sortUploads([
      fileOf('a.pdf', 'application/pdf'),
      fileOf('empty.txt', 'text/plain', 0),
      big,
    ]);

    expect(accepted.map(({ file, kind }) => [file.name, kind])).toEqual([['a.pdf', FILE]]);
    expect(rejected).toEqual([
      { name: 'empty.txt', reason: 'empty' },
      { name: 'big.png', reason: 'over 100 MB' },
    ]);
  });
});

describe('readDroppedFiles', () => {
  const itemOf = (file: File, isDirectory = false) => ({
    kind: 'file',
    getAsFile: () => file,
    webkitGetAsEntry: () => ({ isDirectory }),
  });

  it('leaves out folders and counts them', () => {
    const file = fileOf('a.txt', 'text/plain');
    const dropped = readDroppedFiles({
      items: [itemOf(file), itemOf(fileOf('docs', ''), true)] as unknown as DataTransferItemList,
      files: [] as unknown as FileList,
    });

    expect(dropped).toEqual({ files: [file], folderCount: 1 });
  });

  it('falls back on the file list without items', () => {
    const file = fileOf('a.txt', 'text/plain');
    const dropped = readDroppedFiles({
      items: [] as unknown as DataTransferItemList,
      files: [file] as unknown as FileList,
    });

    expect(dropped).toEqual({ files: [file], folderCount: 0 });
  });
});

describe('toDropzoneAccept', () => {
  it('maps each MIME type to no extra extensions', () => {
    expect(toDropzoneAccept(['image/png', 'image/gif'])).toEqual({
      'image/png': [],
      'image/gif': [],
    });
  });
});
