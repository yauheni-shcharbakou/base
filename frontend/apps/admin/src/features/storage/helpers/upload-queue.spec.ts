import { BrowserStorage } from '@packages/proto';
import {
  getCompleteDeadline,
  isRateLimited,
  pickUploadWork,
  QueuedUpload,
  summarizeUploads,
  UPLOAD_COMPLETE_BATCH,
  UPLOAD_COMPLETE_DELAY_MS,
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

describe('isRateLimited', () => {
  it('tells the gateway’s rate limit from any other refusal', () => {
    expect(isRateLimited(Object.assign(new Error('slow down'), { statusCode: 429 }))).toBe(true);
    expect(isRateLimited(Object.assign(new Error('bad'), { statusCode: 400 }))).toBe(false);
    expect(isRateLimited(undefined)).toBe(false);
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
