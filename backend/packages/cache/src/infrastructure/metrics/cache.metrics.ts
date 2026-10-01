import { Injectable } from '@nestjs/common';
import { CacheOperation } from '../../domain';

export type CacheMetricsSnapshot = {
  /** Reads that found a value. */
  hits: number;
  /** Reads that did not — a genuine miss *or* a swallowed store failure. */
  misses: number;
  /** Writes that reached the store. */
  writes: number;
  /** Store failures, the number the fail-soft path would otherwise hide. */
  errors: number;
  errorsByOperation: Record<CacheOperation, number>;
  /** When the last failure happened, so a stale error count is recognisable as stale. */
  lastErrorAt: Date | null;
};

const buildOperationCounters = (): Record<CacheOperation, number> => ({
  get: 0,
  set: 0,
  has: 0,
  delete: 0,
  deleteByPrefix: 0,
  increment: 0,
});

/**
 * In-process counters for what `CacheService` decides not to throw.
 *
 * Fail-soft means a Redis outage reaches nobody as an error: reads answer `null`, the callers
 * recompute, and the only trace is a log line and load on the database. These counters are the
 * signal that makes the outage visible — `errors` against `hits + misses` is the ratio worth an
 * alert.
 *
 * Deliberately a plain object, not a metrics client: the repository runs no Prometheus, and a
 * dependency in this package would land in every service that wants a key-value store. A
 * consumer that has a scrape endpoint reads `snapshot()` and shapes it however it likes.
 *
 * One instance per `CacheModule`, shared with every `scope()` child — a connection is up or down
 * for all of them, so per-namespace counters would only split the same number.
 */
@Injectable()
export class CacheMetrics {
  private hits = 0;
  private misses = 0;
  private writes = 0;
  private errors = 0;
  private errorsByOperation = buildOperationCounters();
  private lastErrorAt: Date | null = null;

  recordHit(): void {
    this.hits += 1;
  }

  recordMiss(): void {
    this.misses += 1;
  }

  recordWrite(): void {
    this.writes += 1;
  }

  recordError(operation: CacheOperation): void {
    this.errors += 1;
    this.errorsByOperation[operation] += 1;
    this.lastErrorAt = new Date();
  }

  snapshot(): CacheMetricsSnapshot {
    return {
      hits: this.hits,
      misses: this.misses,
      writes: this.writes,
      errors: this.errors,
      errorsByOperation: { ...this.errorsByOperation },
      lastErrorAt: this.lastErrorAt,
    };
  }

  /** For a scrape that reports deltas, and for specs. */
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.writes = 0;
    this.errors = 0;
    this.errorsByOperation = buildOperationCounters();
    this.lastErrorAt = null;
  }
}
