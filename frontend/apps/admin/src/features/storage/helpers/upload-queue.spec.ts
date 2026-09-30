import { BrowserStorage } from '@packages/proto';
import { pickUploadWork, QueuedUpload, summarizeUploads } from './upload-queue';

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

  it('has nothing to do without a queued item', () => {
    expect(pickUploadWork([itemOf('a', { status: 'failed' })], NOW)).toBeUndefined();
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
