import { Logger } from '@nestjs/common';
import { CacheSerializer } from './cache.serializer';

describe('CacheSerializer', () => {
  const serializer = new CacheSerializer();

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('round-trip', () => {
    // The falsy ones are the reason values are wrapped in `{ value }` rather than stringified
    // bare — a bare parse cannot tell a stored `null` from a missing key.
    it.each([
      ['an object', { id: 'user-1', roles: ['admin'] }],
      ['an array', [1, 2, 3]],
      ['a string', 'value'],
      ['zero', 0],
      ['false', false],
      ['an empty string', ''],
      ['null', null],
    ])('preserves %s', (_name, value) => {
      expect(serializer.deserialize(serializer.serialize(value))).toEqual(value);
    });

    it('detaches the value, so mutating the source leaves the cached copy alone', () => {
      const source = { roles: ['admin'] };
      const raw = serializer.serialize(source);

      source.roles.push('user');

      expect(serializer.deserialize<typeof source>(raw)).toEqual({ roles: ['admin'] });
    });

    it('stores undefined as a future miss', () => {
      expect(serializer.deserialize(serializer.serialize(undefined))).toBeNull();
    });
  });

  describe('deserialize', () => {
    it('reads a missing key as a miss', () => {
      expect(serializer.deserialize(null)).toBeNull();
    });

    it('reads a corrupt entry as a miss instead of throwing', () => {
      expect(serializer.deserialize('{ not json')).toBeNull();
    });
  });
});
