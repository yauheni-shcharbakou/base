import { BrowserStorage } from '@packages/proto';
import type { QueuedUpload } from './upload-queue';
import { getReplaceStep, holdReplacedItem, REPLACED_HOLD_MS } from './upload-replace';

const { FILE, IMAGE } = BrowserStorage.StorageObjectType;

const SCOPE = 'folder|page 1';
const NOW = 1_000_000;

const entity = { id: 'file-new', upload: { expires: '0' } };
const uploadOf = (
  status: QueuedUpload['status'],
  withEntity = true,
): Pick<QueuedUpload, 'status' | 'kind' | 'entity'> => ({
  status,
  kind: FILE,
  entity: withEntity ? entity : undefined,
});

const a = { id: 'a', fileId: 'file-a' };
const b = { id: 'b', fileId: 'file-b' };
const failed = { id: 'failed', fileId: 'file-old' };
const fresh = { id: 'new', fileId: 'file-new' };

describe('holdReplacedItem', () => {
  const held = { item: failed, index: 1, scope: SCOPE };

  it('keeps the replaced item where it stood', () => {
    expect(holdReplacedItem([a, b], SCOPE, held)).toEqual([a, failed, b]);
  });

  it('puts it last on a page that has grown shorter', () => {
    expect(holdReplacedItem([a], SCOPE, { ...held, index: 5 })).toEqual([a, failed]);
  });

  it('leaves a page that still lists it, another listing, and a page with nothing held', () => {
    const listed = [a, failed, b];

    expect(holdReplacedItem(listed, SCOPE, held)).toBe(listed);
    expect(holdReplacedItem([a, b], 'folder|page 2', held)).toEqual([a, b]);
    expect(holdReplacedItem([a, b], SCOPE)).toEqual([a, b]);
  });
});

describe('getReplaceStep', () => {
  const held = { scope: SCOPE };
  const state = { items: [a, b], scope: SCOPE, now: NOW };

  it('holds while the upload is on its way', () => {
    for (const status of ['queued', 'creating', 'uploading', 'uploaded', 'completing'] as const) {
      expect(getReplaceStep(held, { ...state, upload: uploadOf(status) })).toEqual({
        type: 'hold',
      });
    }
  });

  it('swaps once the new item is listed, found by its file row', () => {
    expect(
      getReplaceStep(held, { ...state, upload: uploadOf('done'), items: [a, fresh, b] }),
    ).toEqual({ type: 'swap', id: 'new' });
  });

  it('swaps for an item listed before its bytes are in, and for one whose upload failed', () => {
    const items = [a, fresh];

    expect(getReplaceStep(held, { ...state, upload: uploadOf('uploading'), items })).toEqual({
      type: 'swap',
      id: 'new',
    });
    expect(getReplaceStep(held, { ...state, upload: uploadOf('failed'), items })).toEqual({
      type: 'swap',
      id: 'new',
    });
  });

  it('finds an image by its backing file', () => {
    const upload = {
      status: 'done',
      kind: IMAGE,
      entity: { ...entity, id: 'image', fileId: 'file-new' },
    } as const;

    expect(getReplaceStep(held, { ...state, upload, items: [fresh] })).toEqual({
      type: 'swap',
      id: 'new',
    });
  });

  it('releases for an upload dismissed, or failed before its record was made', () => {
    expect(getReplaceStep(held, state)).toEqual({ type: 'release' });
    expect(getReplaceStep(held, { ...state, upload: uploadOf('failed', false) })).toEqual({
      type: 'release',
    });
  });

  it('releases on another listing', () => {
    expect(
      getReplaceStep(held, { ...state, upload: uploadOf('uploading'), scope: 'folder|page 2' }),
    ).toEqual({ type: 'release' });
  });

  it('gives the listing a moment once the upload rests, then lets go', () => {
    const upload = uploadOf('done');

    expect(getReplaceStep(held, { ...state, upload })).toEqual({ type: 'settle' });
    expect(getReplaceStep({ ...held, settledAt: NOW - 1 }, { ...state, upload })).toEqual({
      type: 'hold',
    });
    expect(
      getReplaceStep({ ...held, settledAt: NOW - REPLACED_HOLD_MS }, { ...state, upload }),
    ).toEqual({ type: 'release' });
  });
});
