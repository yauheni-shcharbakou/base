import { BrowserStorage } from '@packages/proto';
import {
  getChildOnPath,
  getFolderItemDownloadUrl,
  getFolderItemOpenUrl,
  getFolderItemTarget,
  getFolderItemUnavailableReason,
} from './folder-item-target';

const { FILE, IMAGE, VIDEO, FOLDER } = BrowserStorage.StorageObjectType;
const { READY, PENDING, UPLOADED, FAILED } = BrowserStorage.FileUploadStatus;

describe('getFolderItemTarget', () => {
  it('goes into a folder', () => {
    expect(getFolderItemTarget({ id: 'f1', type: FOLDER })).toEqual({
      kind: 'folder',
      href: '/storage/storage-objects/f1/content',
    });
  });

  it('opens a READY file or image through the file open route', () => {
    const file = { uploadStatus: READY };

    expect(getFolderItemTarget({ id: 'o1', type: FILE, fileId: 'file1', file })).toEqual({
      kind: 'external',
      href: '/api/files/file1/open',
    });
    expect(getFolderItemTarget({ id: 'o2', type: IMAGE, fileId: 'file2', file })).toEqual({
      kind: 'external',
      href: '/api/files/file2/open',
    });
  });

  it('opens a READY video in its player', () => {
    expect(
      getFolderItemTarget({
        id: 'o1',
        type: VIDEO,
        fileId: 'file1',
        videoId: 'video1',
        file: { uploadStatus: READY },
      }),
    ).toEqual({ kind: 'external', href: '/api/videos/video1/player' });
  });

  // No URL exists before the upload is done: the viewer says what state it is in.
  it('leads nowhere for media that is not READY', () => {
    const target = { kind: 'unavailable' };

    expect(
      getFolderItemTarget({ id: 'o1', type: FILE, fileId: 'f', file: { uploadStatus: PENDING } }),
    ).toEqual(target);
    expect(
      getFolderItemTarget({
        id: 'o1',
        type: VIDEO,
        videoId: 'v',
        file: { uploadStatus: UPLOADED },
      }),
    ).toEqual(target);
    expect(getFolderItemTarget({ id: 'o1', type: FILE })).toEqual(target);
  });
});

describe('getFolderItemUnavailableReason', () => {
  it('says what the upload is at', () => {
    const reasonOf = (uploadStatus: BrowserStorage.FileUploadStatus) =>
      getFolderItemUnavailableReason({ id: 'o', type: FILE, fileId: 'f', file: { uploadStatus } });

    expect(reasonOf(PENDING)).toBe('Upload not finished');
    expect(reasonOf(UPLOADED)).toBe('Uploaded — still being processed');
    expect(reasonOf(FAILED)).toBe('Upload failed');
  });

  it('says there is no file when the row names none', () => {
    expect(getFolderItemUnavailableReason({ id: 'o', type: FILE })).toBe('No file to open');
    expect(
      getFolderItemUnavailableReason({ id: 'o', type: VIDEO, file: { uploadStatus: READY } }),
    ).toBe('No file to open');
  });

  it('has nothing to say of a folder or of an item that opens', () => {
    expect(getFolderItemUnavailableReason({ id: 'f', type: FOLDER })).toBeUndefined();
    expect(
      getFolderItemUnavailableReason({
        id: 'o',
        type: IMAGE,
        fileId: 'f',
        file: { uploadStatus: READY },
      }),
    ).toBeUndefined();
  });
});

describe('getFolderItemOpenUrl / getFolderItemDownloadUrl', () => {
  it('downloads a video by its own id and anything else by its file', () => {
    const file = { uploadStatus: READY };

    expect(
      getFolderItemDownloadUrl({ id: 'o', type: VIDEO, videoId: 'v', fileId: 'f', file }),
    ).toBe('/api/videos/v/download');
    expect(getFolderItemDownloadUrl({ id: 'o', type: IMAGE, fileId: 'f', file })).toBe(
      '/api/files/f/download',
    );
  });

  it('gives no URL for a folder', () => {
    expect(getFolderItemOpenUrl({ id: 'o', type: FOLDER })).toBeUndefined();
    expect(getFolderItemDownloadUrl({ id: 'o', type: FOLDER })).toBeUndefined();
  });
});

describe('getChildOnPath', () => {
  const ancestors = [{ id: 'root' }, { id: 'a' }, { id: 'b' }];

  it('marks the folder itself in its parent', () => {
    expect(getChildOnPath(ancestors, 'c', 'b')).toBe('c');
  });

  it('marks the next folder down the path in a higher ancestor', () => {
    expect(getChildOnPath(ancestors, 'c', 'root')).toBe('a');
  });

  it('marks nothing outside the path, or in the folder itself', () => {
    expect(getChildOnPath(ancestors, 'c', 'elsewhere')).toBeUndefined();
    expect(getChildOnPath(ancestors, 'c', 'c')).toBeUndefined();
  });
});
