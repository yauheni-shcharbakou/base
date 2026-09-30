/** The most ids one batch call takes — the gateway's cap, the largest page of a folder. */
export const STORAGE_BATCH_LIMIT = 100;

/**
 * A batch run that stopped part way: `done` went through in the calls before the one that failed,
 * whose error is `cause`. Each call is all or none, so nothing of the failed call's items changed.
 */
export class StorageBatchError<T> extends Error {
  constructor(
    readonly done: T[],
    readonly cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'StorageBatchError';
  }
}

/**
 * Runs a batch call over any number of items, `limit` at a time and one call after another — a
 * selection gathered over several pages may pass the gateway's cap. Each call is atomic, the whole
 * is not: a failure stops the run with a `StorageBatchError` that says what went through.
 */
export const runInBatches = async <T, R>(
  items: T[],
  run: (batch: T[]) => Promise<R[]>,
  limit = STORAGE_BATCH_LIMIT,
): Promise<R[]> => {
  const results: R[] = [];
  const done: T[] = [];

  for (let start = 0; start < items.length; start += limit) {
    const batch = items.slice(start, start + limit);

    try {
      results.push(...(await run(batch)));
    } catch (error) {
      throw new StorageBatchError(done, error);
    }

    done.push(...batch);
  }

  return results;
};
