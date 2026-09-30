import { getQueryRetryDelay, isRetryableError, retryUpTo } from './query-retry';

const failure = (patch: object) => Object.assign(new Error('failed'), patch);

describe('isRetryableError', () => {
  it('tries again after the rate limit, a server failure, or no status', () => {
    expect(isRetryableError(failure({ statusCode: 429 }))).toBe(true);
    expect(isRetryableError(failure({ statusCode: 503 }))).toBe(true);
    expect(isRetryableError(new Error('network'))).toBe(true);
  });

  it('does not try again a client error, which answers the same every time', () => {
    expect(isRetryableError(failure({ statusCode: 404 }))).toBe(false);
    expect(isRetryableError(failure({ statusCode: 403 }))).toBe(false);
  });
});

describe('retryUpTo', () => {
  it('stops after the given number of retries', () => {
    const retry = retryUpTo(2);
    const error = failure({ statusCode: 429 });

    expect([0, 1, 2].map((count) => retry(count, error))).toEqual([true, true, false]);
  });
});

describe('getQueryRetryDelay', () => {
  it('waits until the gateway’s window resets', () => {
    expect(getQueryRetryDelay(0, failure({ statusCode: 429, retryAfterMs: 12_000 }))).toBe(12_000);
  });

  it('backs off as React Query does otherwise, up to half a minute', () => {
    const error = failure({ statusCode: 503 });

    expect([0, 1, 2, 10].map((count) => getQueryRetryDelay(count, error))).toEqual([
      1000, 2000, 4000, 30_000,
    ]);
  });
});
