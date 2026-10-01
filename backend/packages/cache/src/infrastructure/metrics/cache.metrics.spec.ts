import { CacheMetrics } from './cache.metrics';

describe('CacheMetrics', () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = new CacheMetrics();
  });

  it('starts at zero with every operation counter present', () => {
    expect(metrics.snapshot()).toEqual({
      hits: 0,
      misses: 0,
      writes: 0,
      errors: 0,
      errorsByOperation: { get: 0, set: 0, has: 0, delete: 0, deleteByPrefix: 0, increment: 0 },
      lastErrorAt: null,
    });
  });

  it('counts failures both in total and per operation, and stamps the last one', () => {
    metrics.recordError('get');
    metrics.recordError('get');
    metrics.recordError('deleteByPrefix');

    const snapshot = metrics.snapshot();

    expect(snapshot.errors).toBe(3);
    expect(snapshot.errorsByOperation).toMatchObject({ get: 2, deleteByPrefix: 1, set: 0 });
    expect(snapshot.lastErrorAt).toBeInstanceOf(Date);
  });

  it('hands out a copy, so a caller cannot edit the counters it read', () => {
    metrics.recordError('set');

    const snapshot = metrics.snapshot();
    snapshot.errorsByOperation.set = 99;

    expect(metrics.snapshot().errorsByOperation.set).toBe(1);
  });

  it('resets every counter', () => {
    metrics.recordHit();
    metrics.recordMiss();
    metrics.recordWrite();
    metrics.recordError('has');

    metrics.reset();

    expect(metrics.snapshot()).toMatchObject({ hits: 0, misses: 0, writes: 0, errors: 0 });
    expect(metrics.snapshot().lastErrorAt).toBeNull();
  });
});
