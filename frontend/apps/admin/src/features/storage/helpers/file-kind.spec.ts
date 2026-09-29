import { BrowserStorage } from '@packages/proto';
import { getStorageItemKind, StorageItemKind } from './file-kind';

const { FILE, IMAGE, VIDEO, FOLDER } = BrowserStorage.StorageObjectType;

const file = (mimeType: string, extension = '') => ({ type: FILE, file: { mimeType, extension } });

describe('getStorageItemKind', () => {
  it('takes a folder, an image and a video from the storage type', () => {
    expect(getStorageItemKind({ type: FOLDER })).toBe(StorageItemKind.FOLDER);
    expect(getStorageItemKind({ type: IMAGE })).toBe(StorageItemKind.IMAGE);
    expect(
      getStorageItemKind({ type: VIDEO, file: { mimeType: 'application/pdf', extension: 'pdf' } }),
    ).toBe(StorageItemKind.VIDEO);
  });

  it('tells a plain file by its exact MIME type first', () => {
    expect(getStorageItemKind(file('application/pdf'))).toBe(StorageItemKind.PDF);
    expect(getStorageItemKind(file('text/csv'))).toBe(StorageItemKind.SPREADSHEET);
    expect(getStorageItemKind(file('application/zip; charset=binary'))).toBe(
      StorageItemKind.ARCHIVE,
    );
  });

  it('falls back to the MIME group', () => {
    expect(getStorageItemKind(file('audio/mpeg'))).toBe(StorageItemKind.AUDIO);
    expect(getStorageItemKind(file('image/png'))).toBe(StorageItemKind.IMAGE);
    expect(getStorageItemKind(file('text/plain'))).toBe(StorageItemKind.TEXT);
  });

  it('falls back to the extension for a generic MIME type', () => {
    expect(getStorageItemKind(file('application/octet-stream', 'DOCX'))).toBe(
      StorageItemKind.DOCUMENT,
    );
    expect(getStorageItemKind(file('', '.key'))).toBe(StorageItemKind.PRESENTATION);
  });

  it('calls anything else other', () => {
    expect(getStorageItemKind(file('application/octet-stream', 'bin'))).toBe(StorageItemKind.OTHER);
    expect(getStorageItemKind({ type: FILE })).toBe(StorageItemKind.OTHER);
  });
});
