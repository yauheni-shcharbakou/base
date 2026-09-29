type Waiting<Value> = {
  resolve: (value: Value | null) => void;
  reject: (error: unknown) => void;
};

export type BatchLoader<Value> = {
  load: (key: string) => Promise<Value | null>;
};

/**
 * Coalesces loads of one key each into a single call: the keys asked for within one macrotask go to
 * `loadMany` together, each once, and every caller gets its own key's value — `null` for a key the
 * answer leaves out. A failed call fails every load it carried.
 */
export const createBatchLoader = <Value>(
  loadMany: (keys: string[]) => Promise<Record<string, Value>>,
): BatchLoader<Value> => {
  let queue = new Map<string, Waiting<Value>[]>();

  const flush = async () => {
    const batch = queue;
    queue = new Map();

    try {
      const values = await loadMany(Array.from(batch.keys()));
      batch.forEach((waiting, key) =>
        waiting.forEach(({ resolve }) => resolve(values[key] ?? null)),
      );
    } catch (error) {
      batch.forEach((waiting) => waiting.forEach(({ reject }) => reject(error)));
    }
  };

  return {
    load: (key) =>
      new Promise((resolve, reject) => {
        if (!queue.size) {
          setTimeout(flush);
        }

        queue.set(key, [...(queue.get(key) ?? []), { resolve, reject }]);
      }),
  };
};
