import { MemoryCacheStore } from './memory.cache.store';

describe('MemoryCacheStore', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads back what it stored', async () => {
    const store = new MemoryCacheStore();

    await store.set('cache:auth:user:1', { id: '1' });

    await expect(store.get('cache:auth:user:1')).resolves.toEqual({ id: '1' });
    await expect(store.has('cache:auth:user:1')).resolves.toBe(true);
  });

  it('reads a missing key as null', async () => {
    await expect(new MemoryCacheStore().get('nothing')).resolves.toBeNull();
  });

  // Serialisation is shared with the Redis adapter precisely so this holds in both.
  it("detaches the stored value from the caller's object", async () => {
    const store = new MemoryCacheStore();
    const source = { roles: ['admin'] };

    await store.set('cache:auth:user:1', source);
    source.roles.push('user');

    await expect(store.get('cache:auth:user:1')).resolves.toEqual({ roles: ['admin'] });
  });

  describe('expiry', () => {
    it('drops an entry once its TTL has passed', async () => {
      jest.useFakeTimers();

      const store = new MemoryCacheStore();

      await store.set('cache:auth:user:1', 'value', 60);
      jest.advanceTimersByTime(59_000);
      await expect(store.get('cache:auth:user:1')).resolves.toBe('value');

      jest.advanceTimersByTime(2_000);
      await expect(store.get('cache:auth:user:1')).resolves.toBeNull();
      await expect(store.has('cache:auth:user:1')).resolves.toBe(false);
    });

    it.each([
      ['no TTL', undefined],
      ['a zero TTL', 0],
    ])('keeps an entry stored with %s', async (_name, ttl) => {
      jest.useFakeTimers();

      const store = new MemoryCacheStore();

      await store.set('cache:auth:user:1', 'value', ttl);
      jest.advanceTimersByTime(10 * 24 * 3600 * 1000);

      await expect(store.get('cache:auth:user:1')).resolves.toBe('value');
    });
  });

  describe('delete', () => {
    it('counts only the keys that existed', async () => {
      const store = new MemoryCacheStore();

      await store.set('a', 1);

      await expect(store.delete('a', 'b')).resolves.toBe(1);
      await expect(store.get('a')).resolves.toBeNull();
    });
  });

  describe('deleteByPrefix', () => {
    it('removes the matching keys and leaves the rest', async () => {
      const store = new MemoryCacheStore();

      await store.set('cache:auth:user:1', 1);
      await store.set('cache:auth:user:2', 2);
      await store.set('cache:auth:session:1', 3);

      await expect(store.deleteByPrefix('cache:auth:user:')).resolves.toBe(2);
      await expect(store.get('cache:auth:session:1')).resolves.toBe(3);
    });
  });

  describe('increment', () => {
    it('starts at 1 and counts up', async () => {
      const store = new MemoryCacheStore();

      await expect(store.increment('hits', 60_000)).resolves.toEqual({ value: 1, ttlMs: 60_000 });
      await expect(store.increment('hits', 60_000)).resolves.toMatchObject({ value: 2 });
    });

    it('keeps the window the first hit started, then starts over', async () => {
      jest.useFakeTimers();

      const store = new MemoryCacheStore();

      await store.increment('hits', 60_000);
      jest.advanceTimersByTime(40_000);
      await expect(store.increment('hits', 60_000)).resolves.toEqual({ value: 2, ttlMs: 20_000 });

      jest.advanceTimersByTime(20_000);
      await expect(store.increment('hits', 60_000)).resolves.toEqual({ value: 1, ttlMs: 60_000 });
    });

    it('refuses a key holding a value, as Redis does', async () => {
      const store = new MemoryCacheStore();

      await store.set('user:1', { id: '1' });

      await expect(store.increment('user:1', 60_000)).rejects.toThrow('does not hold a counter');
    });
  });
});
