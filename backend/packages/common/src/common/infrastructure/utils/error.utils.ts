const DEFAULT_MESSAGE = 'Unknown error';

/** Cause chains are shallow in practice; the limit only guards pathological nesting. */
const MAX_DEPTH = 10;

const trim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * First non-empty message in the error's `cause` chain, descending into an
 * `AggregateError`'s `errors` on the way, with the error's class name as the last resort.
 *
 * A wrapper error often carries no message of its own: MikroORM 7 turns a driver failure
 * into a `DriverException` built from the underlying error, and when the driver could not
 * reach the database that error is the `AggregateError` Node produces for a connection
 * refused on several addresses — itself message-less, with the real reason
 * ("connect ECONNREFUSED 127.0.0.1:5432") one more level down in `errors`.
 *
 * It lives here rather than in one adapter because both event-bus transports need it: the
 * Redis one persists `error.message` into a BullMQ job's `failedReason` — the `failed` set
 * is its DLQ, and an empty message leaves a job there that cannot be triaged without
 * correlating timestamps against the service logs — and the NATS one has no DLQ at all, so
 * the log line is the only record a failure leaves behind.
 *
 * Callers pass their own `fallback` to say which subsystem the failure came from.
 */
export const resolveErrorMessage = (error: unknown, fallback: string = DEFAULT_MESSAGE): string =>
  findMessage(error, new Set(), 0) || describeError(error) || fallback;

const findMessage = (error: unknown, seen: Set<unknown>, depth: number): string => {
  if (typeof error === 'string') {
    return error.trim();
  }

  if (!error || typeof error !== 'object' || depth > MAX_DEPTH || seen.has(error)) {
    return '';
  }

  seen.add(error);

  const own = trim((error as { message?: unknown }).message);

  if (own) {
    return own;
  }

  const aggregated = (error as { errors?: unknown }).errors;

  const nested = [
    (error as { cause?: unknown }).cause,
    ...(Array.isArray(aggregated) ? aggregated : []),
  ];

  for (const candidate of nested) {
    const message = findMessage(candidate, seen, depth + 1);

    if (message) {
      return message;
    }
  }

  return '';
};

/**
 * The class of a message-less error ("DriverException") still says more than an empty
 * string. A plain object carries no such hint, so it falls through to the caller's default.
 */
const describeError = (error: unknown): string => {
  if (!error || typeof error !== 'object') {
    return '';
  }

  const name = trim(error.constructor?.name) || trim((error as Error).name);

  return name === 'Object' ? '' : name;
};
