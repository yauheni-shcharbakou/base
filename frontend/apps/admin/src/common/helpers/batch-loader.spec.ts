import { createBatchLoader } from './batch-loader';

describe('createBatchLoader', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const setup = (values: Record<string, string> = { a: 'A', b: 'B' }) => {
    // Answers the keys it knows of those asked, as the gateway does.
    const loadMany = jest.fn(async (keys: string[]) =>
      keys.reduce<Record<string, string>>(
        (found, key) => (key in values ? { ...found, [key]: values[key] } : found),
        {},
      ),
    );
    return { loadMany, loader: createBatchLoader(loadMany) };
  };

  it('loads the keys of one macrotask in one call, each once', async () => {
    const { loadMany, loader } = setup();

    const loads = Promise.all([loader.load('a'), loader.load('b'), loader.load('a')]);
    jest.runAllTimers();

    await expect(loads).resolves.toEqual(['A', 'B', 'A']);
    expect(loadMany).toHaveBeenCalledTimes(1);
    expect(loadMany).toHaveBeenCalledWith(['a', 'b']);
  });

  it('answers null for a key the call leaves out', async () => {
    const { loader } = setup();

    const load = loader.load('missing');
    jest.runAllTimers();

    await expect(load).resolves.toBeNull();
  });

  it('starts a new call for keys asked after the last one went', async () => {
    const { loadMany, loader } = setup();

    const first = loader.load('a');
    jest.runAllTimers();
    await first;

    const second = loader.load('b');
    jest.runAllTimers();

    await expect(second).resolves.toBe('B');
    expect(loadMany).toHaveBeenNthCalledWith(2, ['b']);
  });

  it('fails every load of a failed call', async () => {
    const error = new Error('unavailable');
    const loader = createBatchLoader(() => Promise.reject(error));

    const loads = [loader.load('a'), loader.load('b')];
    jest.runAllTimers();

    await expect(loads[0]).rejects.toBe(error);
    await expect(loads[1]).rejects.toBe(error);
  });
});
