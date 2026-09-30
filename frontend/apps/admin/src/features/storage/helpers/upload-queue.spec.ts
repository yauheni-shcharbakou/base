import { BrowserStorage } from '@packages/proto';
import {
  getCompleteDeadline,
  getUploadRowStatus,
  groupUploads,
  getRateLimitPause,
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
