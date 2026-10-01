import { buildCacheKey } from './cache.key';

describe('buildCacheKey', () => {
  it('joins the segments with the Redis delimiter', () => {
    expect(buildCacheKey('cache', 'auth', 'user')).toBe('cache:auth:user');
  });

  it('drops empty, blank and missing segments instead of leaving "::"', () => {
    expect(buildCacheKey('cache', '', undefined, '  ', 'user')).toBe('cache:user');
  });

  it('normalises a segment that already carries the delimiter', () => {
    expect(buildCacheKey('cache', 'auth', 'user:1')).toBe(
      buildCacheKey('cache', 'auth', 'user', '1'),
    );
  });

  it('trims the parts, so a stray space cannot fork the keyspace', () => {
    expect(buildCacheKey(' cache ', 'auth ', ' user')).toBe('cache:auth:user');
  });

  it('returns an empty string when nothing survives', () => {
    expect(buildCacheKey(undefined, '', ':')).toBe('');
  });
});
