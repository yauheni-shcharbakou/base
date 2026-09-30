import { runInBatches, StorageBatchError } from './storage-batch';

describe('runInBatches', () => {
  const items = [1, 2, 3, 4, 5];

  it('calls once per batch, in order, and joins the results', async () => {
    const run = jest.fn(async (batch: number[]) => batch.map((item) => item * 10));

    await expect(runInBatches(items, run, 2)).resolves.toEqual([10, 20, 30, 40, 50]);
    expect(run.mock.calls).toEqual([[[1, 2]], [[3, 4]], [[5]]]);
  });

  it('stops at the failed batch and says what went through before it', async () => {
    const cause = new Error('Storage object not found');
    const run = jest.fn(async (batch: number[]) => {
      if (batch.includes(3)) {
        throw cause;
      }

      return batch;
    });

    const error = await runInBatches(items, run, 2).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(StorageBatchError);
    expect((error as StorageBatchError<number>).done).toEqual([1, 2]);
    expect((error as StorageBatchError<number>).cause).toBe(cause);
    expect((error as Error).message).toBe('Storage object not found');
    expect(run).toHaveBeenCalledTimes(2);
  });
});
