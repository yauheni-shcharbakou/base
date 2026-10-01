import { BrowserStorage } from '@packages/proto';
import {
  findFailedUpload,
  findUploadOf,
  getCompleteDeadline,
  getItemUploadState,
  getUploadFileId,
  getUploadProgress,
  getUploadRowStatus,
  groupUploads,
  getRateLimitPause,
  isReplacedBy,
  isUploadActive,
  pickUploadWork,
  QueuedUpload,
  summarizeUploads,
  UPLOAD_COMPLETE_BATCH,
  UPLOAD_COMPLETE_DELAY_MS,
  UPLOAD_RATE_LIMIT_PAUSE_MS,
} from './upload-queue';

const { FILE, VIDEO } = BrowserStorage.StorageObjectType;
const NOW = 1_000_000_000_000;
const fresh = { id: 'e', upload: { expires: String(NOW / 1000 + 3600) } };
const stale = { id: 'e', upload: { expires: String(NOW / 1000 + 60) } };

const itemOf = (key: string, patch: Partial<QueuedUpload> = {}): QueuedUpload => ({
  key,
  file: new File([new Uint8Array(100)], `${key}.txt`),
  kind: FILE,
  userId: 'u',
  folder: { id: 'f', name: 'docs' },
  status: 'queued',
  progress: 0,
  ...patch,
});

describe('pickUploadWork', () => {
  it('uploads the first queued item once its record is made', () => {
    const items = [itemOf('a', { status: 'done' }), itemOf('b', { entity: fresh }), itemOf('c')];
    expect(pickUploadWork(items, NOW)).toEqual({ type: 'upload', key: 'b' });
  });

  it('makes the records of the queued items one call can take together', () => {
    const items = [
      itemOf('a'),
      itemOf('b', { folder: { id: 'g', name: 'other' } }),
      itemOf('c', { entity: stale }),
      itemOf('d', { status: 'creating' }),
      itemOf('e'),
    ];

    expect(pickUploadWork(items, NOW)).toEqual({ type: 'create', keys: ['a', 'c', 'e'] });
  });

  it('makes a video’s record only when its turn comes', () => {
    const items = [itemOf('a', { kind: VIDEO }), itemOf('b', { kind: VIDEO })];
    expect(pickUploadWork(items, NOW)).toEqual({ type: 'create', keys: ['a'] });
  });

  describe('confirming', () => {
    const uploaded = (key: string, uploadedAt = NOW) =>
      itemOf(key, { status: 'uploaded', progress: 100, uploadedAt, entity: fresh });

    it('waits for more uploads to confirm with while others are on their way', () => {
      const items = [uploaded('a'), itemOf('b', { status: 'uploading' })];
      expect(pickUploadWork(items, NOW + UPLOAD_COMPLETE_DELAY_MS - 1)).toBeUndefined();
    });

    it('confirms once the oldest has waited long enough', () => {
      const items = [uploaded('a'), uploaded('b', NOW + 500), itemOf('c', { status: 'uploading' })];

      expect(getCompleteDeadline(items)).toBe(NOW + UPLOAD_COMPLETE_DELAY_MS);
      expect(pickUploadWork(items, NOW + UPLOAD_COMPLETE_DELAY_MS)).toEqual({
        type: 'complete',
        keys: ['a', 'b'],
      });
    });

    it('confirms at once when nothing else is on its way', () => {
      const items = [uploaded('a'), itemOf('b', { status: 'done' })];
      expect(pickUploadWork(items, NOW)).toEqual({ type: 'complete', keys: ['a'] });
    });

    it('confirms a full batch at once, and no more than one', () => {
      const items = [
        ...Array.from({ length: UPLOAD_COMPLETE_BATCH + 1 }, (_, i) => uploaded(`u${i}`)),
        itemOf('q', { entity: fresh }),
      ];
      const work = pickUploadWork(items, NOW);

      expect(work?.type).toBe('complete');
      expect(work?.type === 'complete' && work.keys).toHaveLength(UPLOAD_COMPLETE_BATCH);
    });

    it('goes on uploading while the uploaded wait', () => {
      const items = [uploaded('a'), itemOf('b', { entity: fresh })];
      expect(pickUploadWork(items, NOW)).toEqual({ type: 'upload', key: 'b' });
    });
  });

  it('has nothing to do without a queued item', () => {
    expect(pickUploadWork([itemOf('a', { status: 'failed' })], NOW)).toBeUndefined();
  });
});

describe('getUploadFileId', () => {
  it("is a file's own id, and an image's or a video's backing file's", () => {
    const entity = { ...fresh, id: 'record', fileId: 'backing' };

    expect(getUploadFileId(itemOf('a', { entity }))).toBe('record');
    expect(getUploadFileId(itemOf('b', { kind: VIDEO, entity }))).toBe('backing');
  });

  it('is none before the record is made', () => {
    expect(getUploadFileId(itemOf('a'))).toBeUndefined();
  });
});

describe('findFailedUpload', () => {
  const entity = { ...fresh, id: 'file-1' };

  it('finds the failed upload of a file row', () => {
    const items = [
      itemOf('a', { status: 'failed', entity: { ...fresh, id: 'file-0' } }),
      itemOf('b', { status: 'failed', entity }),
    ];

    expect(findFailedUpload(items, 'file-1')?.key).toBe('b');
  });

  it('passes over an upload still on its way, or done', () => {
    const items = [
      itemOf('a', { status: 'uploading', entity }),
      itemOf('b', { status: 'done', entity }),
    ];

    expect(findFailedUpload(items, 'file-1')).toBeUndefined();
  });
});

describe('findUploadOf', () => {
  const own = itemOf('own', { status: 'uploading', entity: { ...fresh, id: 'file-1' } });
  const replacing = itemOf('replacing', { replaces: 'item-1' });

  it("finds the upload an item's file row came from, whatever it is at", () => {
    expect(findUploadOf([own], { id: 'item-9', fileId: 'file-1' })?.key).toBe('own');
    expect(findUploadOf([own], { id: 'item-9', fileId: 'file-2' })).toBeUndefined();
    expect(findUploadOf([own], { id: 'item-9' })).toBeUndefined();
  });

  it("puts the upload taking the item's place first", () => {
    expect(findUploadOf([own, replacing], { id: 'item-1', fileId: 'file-1' })?.key).toBe(
      'replacing',
    );
  });
});

describe('isUploadActive', () => {
  it('holds until the upload rests, done or failed', () => {
    const statuses = ['queued', 'creating', 'uploading', 'uploaded', 'completing'] as const;

    statuses.forEach((status) => expect(isUploadActive({ status })).toBe(true));
    expect(isUploadActive({ status: 'done' })).toBe(false);
    expect(isUploadActive({ status: 'failed' })).toBe(false);
  });
});

describe('isReplacedBy', () => {
  it('names the item the upload takes the place of, and no other', () => {
    const replacing = itemOf('a', { replaces: 'item-1' });

    expect(isReplacedBy(replacing, 'item-1')).toBe(true);
    expect(isReplacedBy(replacing, 'item-2')).toBe(false);
  });

  it('is false for an upload of the item itself, and without one', () => {
    expect(isReplacedBy(itemOf('a'), 'item-1')).toBe(false);
    expect(isReplacedBy(undefined, 'item-1')).toBe(false);
  });
});

describe('getUploadProgress', () => {
  const progressOf = (patch: Partial<QueuedUpload>, itemId = 'item-1') =>
    getUploadProgress(itemOf('a', patch), itemId);

  it('tells how far the bytes are', () => {
    expect(progressOf({ status: 'uploading', progress: 42 })).toEqual({
      label: 'Uploading… 42%',
      percent: 42,
    });
  });

  it('has no percent before the bytes go, or once they are in', () => {
    const waiting = { label: 'Waiting to upload…' };
    const finishing = { label: 'Finishing…' };

    expect(progressOf({ status: 'queued' })).toEqual(waiting);
    expect(progressOf({ status: 'creating' })).toEqual(waiting);
    expect(progressOf({ status: 'uploaded' })).toEqual(finishing);
    expect(progressOf({ status: 'completing' })).toEqual(finishing);
  });

  it('says nothing once the upload rests, or without one', () => {
    expect(progressOf({ status: 'done' })).toBeUndefined();
    expect(progressOf({ status: 'failed' })).toBeUndefined();
    expect(getUploadProgress(undefined, 'item-1')).toBeUndefined();
  });

  it('keeps the replaced item waiting for the listing once its replacement rests', () => {
    const finishing = { label: 'Finishing…' };

    expect(progressOf({ status: 'done', replaces: 'item-1' })).toEqual(finishing);
    expect(progressOf({ status: 'failed', replaces: 'item-1' })).toEqual(finishing);
    expect(progressOf({ status: 'done', replaces: 'item-1' }, 'item-2')).toBeUndefined();
  });
});

describe('getItemUploadState', () => {
  const { PENDING, FAILED, READY } = BrowserStorage.FileUploadStatus;
  const itemAt = (uploadStatus: BrowserStorage.FileUploadStatus) => ({
    id: 'item-1',
    file: { uploadStatus },
  });
  const reason = 'Upload not finished';

  it('says nothing of an item that opens', () => {
    const upload = itemOf('a', { status: 'uploading', progress: 42 });

    expect(getItemUploadState(itemAt(READY), undefined, upload)).toBeUndefined();
  });

  it('tells this tab’s upload on its way, whatever the row says', () => {
    const progress = { label: 'Uploading… 42%', percent: 42 };
    const upload = itemOf('a', { status: 'uploading', progress: 42 });

    expect(getItemUploadState(itemAt(PENDING), reason, upload)).toEqual({
      type: 'progress',
      progress,
    });
    expect(getItemUploadState(itemAt(FAILED), reason, upload)).toEqual({
      type: 'progress',
      progress,
    });
  });

  it('is failed by the backend’s word', () => {
    expect(getItemUploadState(itemAt(FAILED), reason, undefined)).toEqual({ type: 'failed' });
  });

  it('is failed once this tab’s upload died, though the row is still PENDING', () => {
    const upload = itemOf('a', { status: 'failed' });

    expect(getItemUploadState(itemAt(PENDING), reason, upload)).toEqual({ type: 'failed' });
  });

  it('is awaited without an upload here, and with no file at all', () => {
    expect(getItemUploadState(itemAt(PENDING), reason, undefined)).toEqual({ type: 'waiting' });
    expect(getItemUploadState({ id: 'item-1' }, 'No file to open', undefined)).toEqual({
      type: 'waiting',
    });
  });

  it('keeps the replaced item in progress once its replacement rests', () => {
    const upload = itemOf('a', { status: 'failed', replaces: 'item-1' });

    expect(getItemUploadState(itemAt(FAILED), reason, upload)).toEqual({
      type: 'progress',
      progress: { label: 'Finishing…' },
    });
  });
});

describe('getRateLimitPause', () => {
  const refused = (patch: object) => Object.assign(new Error('Too many requests'), patch);

  it('waits until the gateway’s window resets', () => {
    expect(getRateLimitPause(refused({ statusCode: 429, retryAfterMs: 12_000 }))).toBe(12_000);
  });

  it('falls back on a fixed pause when the gateway does not say', () => {
    expect(getRateLimitPause(refused({ statusCode: 429 }))).toBe(UPLOAD_RATE_LIMIT_PAUSE_MS);
  });

  it('does not wait out any other failure', () => {
    expect(getRateLimitPause(refused({ statusCode: 400, retryAfterMs: 5000 }))).toBeUndefined();
    expect(getRateLimitPause(undefined)).toBeUndefined();
  });
});

describe('summarizeUploads', () => {
  it('counts the items and weighs the progress by size', () => {
    const summary = summarizeUploads([
      itemOf('a', { status: 'done' }),
      itemOf('b', { status: 'uploading', progress: 50 }),
      itemOf('c', { status: 'failed' }),
      itemOf('d'),
    ]);

    expect(summary).toEqual({ total: 4, done: 1, failed: 1, active: 2, progress: 37.5 });
  });
});

describe('groupUploads', () => {
  const img = { id: 'img', name: 'img' };

  it('folds a folder’s files into one row where the folder first shows', () => {
    const rows = groupUploads([
      itemOf('a'),
      itemOf('b', { group: img, status: 'done' }),
      itemOf('c'),
      itemOf('d', { group: img, status: 'uploading', progress: 50 }),
    ]);

    expect(rows.map(({ type, key }) => `${type}:${key}`)).toEqual([
      'file:a',
      'folder:img',
      'file:c',
    ]);

    const folder = rows[1];

    expect(folder.type === 'folder' && folder.items.map(({ key }) => key)).toEqual(['b', 'd']);
    expect(folder.type === 'folder' && folder.summary).toMatchObject({
      total: 2,
      done: 1,
      active: 1,
      progress: 75,
    });
  });
});

describe('getUploadRowStatus', () => {
  const folderOf = (...statuses: QueuedUpload['status'][]) =>
    groupUploads(
      statuses.map((status, i) => itemOf(`k${i}`, { group: { id: 'g', name: 'g' }, status })),
    )[0];

  it('keeps a folder on its way while any of its files is', () => {
    expect(getUploadRowStatus(folderOf('done', 'failed', 'uploaded'))).toBe('active');
  });

  it('fails a folder once only failures are left to settle', () => {
    expect(getUploadRowStatus(folderOf('done', 'failed'))).toBe('failed');
    expect(getUploadRowStatus(folderOf('done', 'done'))).toBe('done');
  });

  it('reads a file row by its own status', () => {
    expect(getUploadRowStatus(groupUploads([itemOf('a', { status: 'completing' })])[0])).toBe(
      'active',
    );
  });
});
