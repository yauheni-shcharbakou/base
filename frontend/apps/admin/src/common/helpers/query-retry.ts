// When a failed query is tried again, for every query of the admin: React Query's own backoff,
// unless the gateway's rate limit said how long to wait. Pure, so it is tested without a client;
// imported by path, since the barrel beside it pulls in axios.

// React Query's own backoff: a second, doubled on each failure, capped at half a minute.
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30 * 1000;

// A server action's failure (`unwrapActionResult`) or Refine's `HttpError` — read, never assumed.
type QueryFailure = { statusCode?: number; retryAfterMs?: number } | null | undefined;

/**
 * Worth another try: a call the gateway's rate limit refused, a server failure, or an error with
 * no status at all. Any other 4xx — a missing item, no access — answers the same on every try.
 */
export const isRetryableError = (error: unknown): boolean => {
  const statusCode = (error as QueryFailure)?.statusCode;
  return !statusCode || statusCode === 429 || statusCode >= 500;
};

/** A query's `retry`: a retryable failure, up to `maxRetries` times. */
export const retryUpTo =
  <TError = Error>(maxRetries: number) =>
  (failureCount: number, error: TError): boolean =>
    isRetryableError(error) && failureCount < maxRetries;

/**
 * A query's `retryDelay`: until the gateway's window resets when its rate limit refused the call
 * (`retryAfterMs`, from its `retry-after` trailer), React Query's own backoff otherwise.
 */
export const getQueryRetryDelay = <TError>(failureCount: number, error: TError): number => {
  const retryAfterMs = (error as QueryFailure)?.retryAfterMs;

  if (retryAfterMs && retryAfterMs > 0) {
    return retryAfterMs;
  }

  return Math.min(BASE_DELAY_MS * 2 ** failureCount, MAX_DELAY_MS);
};
