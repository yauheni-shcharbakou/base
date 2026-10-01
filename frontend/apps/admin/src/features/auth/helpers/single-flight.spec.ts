import { SingleFlight } from '@/features/auth/helpers/single-flight';

const GRACE_MS = 30_000;

describe('SingleFlight', () => {
  let time: number;
  let flights: SingleFlight<string>;

  beforeEach(() => {
    time = 0;
    flights = new SingleFlight<string>(GRACE_MS, () => time);
  });

  it('makes one call for concurrent callers of a key, and gives them all its result', async () => {
    const call = jest.fn().mockResolvedValue('tokens');

    const results = await Promise.all([
      flights.run('refresh-a', call),
      flights.run('refresh-a', call),
      flights.run('refresh-a', call),
    ]);

    expect(call).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['tokens', 'tokens', 'tokens']);
  });

  it('keeps separate keys apart', async () => {
    const call = jest.fn().mockResolvedValue('tokens');

    await Promise.all([flights.run('refresh-a', call), flights.run('refresh-b', call)]);

    expect(call).toHaveBeenCalledTimes(2);
  });

  it('reuses a success within the grace period, and calls again after it', async () => {
    const call = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    await flights.run('refresh-a', call);

    time = GRACE_MS - 1;
    expect(await flights.run('refresh-a', call)).toBe('first');

    time = GRACE_MS;
    expect(await flights.run('refresh-a', call)).toBe('second');
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('shares a failure with the callers in flight, and keeps none for the next one', async () => {
    const call = jest.fn().mockRejectedValueOnce(new Error('refused')).mockResolvedValue('tokens');

    const concurrent = await Promise.allSettled([
      flights.run('refresh-a', call),
      flights.run('refresh-a', call),
    ]);

    expect(concurrent.map(({ status }) => status)).toEqual(['rejected', 'rejected']);
    expect(await flights.run('refresh-a', call)).toBe('tokens');
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('turns a call that throws synchronously into a rejection', async () => {
    const call = jest.fn(() => {
      throw new Error('bad input');
    });

    await expect(flights.run('refresh-a', call)).rejects.toThrow('bad input');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('calls again for a key it was told to forget', async () => {
    const call = jest.fn().mockResolvedValue('tokens');

    await flights.run('refresh-a', call);
    flights.forget((key) => key === 'refresh-a');
    await flights.run('refresh-a', call);

    expect(call).toHaveBeenCalledTimes(2);
  });

  it('forgets a flight by the result it succeeded with', async () => {
    const call = jest.fn().mockResolvedValueOnce('refresh-b').mockResolvedValueOnce('refresh-c');

    // The flight is keyed by the old token; a logout only knows the new one it handed out.
    await flights.run('refresh-a', call);
    flights.forget((key, value) => key === 'refresh-b' || value === 'refresh-b');

    expect(await flights.run('refresh-a', call)).toBe('refresh-c');
    expect(call).toHaveBeenCalledTimes(2);
  });
});
