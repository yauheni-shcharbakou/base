import type { CreatedUploadEntity, StorageUploadItem } from '@/features/storage/types';
import {
  attachCreatedEntities,
  CREDENTIALS_EXPIRY_MARGIN_MS,
  hasUsableCredentials,
  pairCreatedEntities,
  planUploadBatch,
} from './upload-batch';

const NOW = Date.UTC(2026, 8, 26, 12);

// `expires` is unix seconds, as both Bunny signatures carry it.
const expiringIn = (ms: number) => String((NOW + ms) / 1000);

const entity = (key: string, expires = expiringIn(60 * 60 * 1000)): CreatedUploadEntity => ({
  id: `entity-${key}`,
  upload: { expires },
});

const item = (key: string, created?: CreatedUploadEntity): StorageUploadItem => ({
  file: { name: `${key}.png` } as File,
  key,
  ...(created ? { entity: created } : {}),
});

describe('hasUsableCredentials', () => {
  it('accepts credentials well within their lifetime', () => {
    expect(hasUsableCredentials(entity('a'), NOW)).toBe(true);
  });

  it('rejects credentials inside the safety margin, not only past expiry', () => {
    expect(hasUsableCredentials(entity('a', expiringIn(CREDENTIALS_EXPIRY_MARGIN_MS)), NOW)).toBe(
      false,
    );
    expect(
      hasUsableCredentials(entity('a', expiringIn(CREDENTIALS_EXPIRY_MARGIN_MS + 1000)), NOW),
    ).toBe(true);
  });

  it('rejects expired credentials', () => {
    expect(hasUsableCredentials(entity('a', expiringIn(-1000)), NOW)).toBe(false);
  });

  // Reusing on a value it cannot read would upload with credentials of unknown age.
  it('rejects an expiry it cannot read', () => {
    expect(hasUsableCredentials(entity('a', ''), NOW)).toBe(false);
    expect(hasUsableCredentials(entity('a', 'soon'), NOW)).toBe(false);
  });
});

describe('planUploadBatch', () => {
  it('creates every item of a first attempt', () => {
    const batch = [item('a'), item('b')];

    const plan = planUploadBatch(batch, NOW);

    expect(plan.toCreate).toEqual(batch);
    expect(plan.reused.size).toBe(0);
  });

  // The duplicate-row bug: a retry used to create the whole batch again.
  it('reuses the entity of an earlier attempt instead of creating it again', () => {
    const created = entity('a');

    const plan = planUploadBatch([item('a', created), item('b')], NOW);

    expect(plan.toCreate.map(({ key }) => key)).toEqual(['b']);
    expect(plan.reused.get('a')).toBe(created);
  });

  it('creates afresh an item whose credentials are about to expire', () => {
    const stale = item('a', entity('a', expiringIn(60 * 1000)));

    const plan = planUploadBatch([stale], NOW);

    expect(plan.toCreate).toEqual([stale]);
    expect(plan.reused.has('a')).toBe(false);
  });

  it('puts each item in exactly one of the two', () => {
    const batch = [
      item('fresh', entity('fresh')),
      item('stale', entity('stale', expiringIn(-1))),
      item('new'),
    ];

    const plan = planUploadBatch(batch, NOW);

    expect(
      [...plan.toCreate.map(({ key }) => key), ...Array.from(plan.reused.keys())].sort(),
    ).toEqual(['fresh', 'new', 'stale']);
  });
});

describe('pairCreatedEntities', () => {
  // The create-many result carries no key of its own: `result[i]` answers `items[i]`.
  it('pairs entities with items by position', () => {
    const first = entity('x');
    const second = entity('y');

    const paired = pairCreatedEntities([item('b'), item('a')], [first, second]);

    expect(Array.from(paired)).toEqual([
      ['b', first],
      ['a', second],
    ]);
  });

  it('refuses a result that does not answer every item', () => {
    expect(() => pairCreatedEntities([item('a'), item('b')], [entity('a')])).toThrow(
      'returned 1 records for 2 files',
    );
  });
});

describe('attachCreatedEntities', () => {
  const created = (...pairs: [string, CreatedUploadEntity][]) => new Map(pairs);

  it('stores each entity on the item it answers', () => {
    const fresh = entity('a');

    const next = attachCreatedEntities({ a: item('a'), b: item('b') }, created(['a', fresh]));

    expect(next.a.entity).toBe(fresh);
    expect(next.b.entity).toBeUndefined();
  });

  it('replaces the stale entity of a re-created item', () => {
    const fresh = entity('a');

    const next = attachCreatedEntities(
      { a: item('a', entity('a', expiringIn(-1))) },
      created(['a', fresh]),
    );

    expect(next.a.entity).toBe(fresh);
  });

  it('does not bring back an item removed while the create call ran', () => {
    const next = attachCreatedEntities({ b: item('b') }, created(['a', entity('a')]));

    expect(Object.keys(next)).toEqual(['b']);
  });

  it('leaves the map it was given untouched', () => {
    const map = { a: item('a') };

    attachCreatedEntities(map, created(['a', entity('a')]));

    expect(map.a.entity).toBeUndefined();
  });
});
