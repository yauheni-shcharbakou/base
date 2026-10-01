import { createHash } from 'node:crypto';
import { getAlignedExpiry, signBunnyCdnUrl } from './bunny.cdn-token';

describe('getAlignedExpiry', () => {
  it('rounds the expiry up to the next multiple of the lifetime', () => {
    expect(getAlignedExpiry(600, 1_700_000_123)).toBe(1_700_001_000);
  });

  it('keeps one value for a whole window and moves on right after it', () => {
    expect(getAlignedExpiry(600, 1_700_000_401)).toBe(1_700_001_600);
    expect(getAlignedExpiry(600, 1_700_000_400)).toBe(1_700_001_000);
    expect(getAlignedExpiry(600, 1_699_999_801)).toBe(1_700_001_000);
  });

  it('leaves a URL at least one lifetime and less than two', () => {
    for (let now = 1_700_000_000; now < 1_700_001_200; now += 37) {
      const expires = getAlignedExpiry(600, now);

      expect(expires % 600).toBe(0);
      expect(expires).toBeGreaterThanOrEqual(now + 600);
      expect(expires).toBeLessThan(now + 1_200);
    }
  });

  it.each([0, -60, Number.NaN])('refuses a lifetime of %p', (ttl) => {
    expect(() => getAlignedExpiry(ttl, 1_700_000_000)).toThrow(RangeError);
  });
});

describe('signBunnyCdnUrl', () => {
  const data = {
    baseUrl: 'https://zone.b-cdn.net',
    path: '/dev/user/photo.png',
    privateKey: 'secret',
    expiresInMinutes: 10,
    now: 1_700_000_123,
  };

  it('signs the path with Bunny basic token auth, and nothing else', () => {
    const url = new URL(signBunnyCdnUrl(data));

    expect(url.origin + url.pathname).toBe('https://zone.b-cdn.net/dev/user/photo.png');
    expect([...url.searchParams.keys()]).toEqual(['token', 'expires']);
    expect(url.searchParams.get('expires')).toBe('1700001000');
    expect(url.searchParams.get('token')).toBe('obslpytrRU7a5Vfw3tJxQQ');
  });

  // The formula the signers used before this helper: a URL signed either way must stay valid.
  it('produces the token of the hand-rolled base64 it replaced', () => {
    const md5 = createHash('md5').update('secret/dev/user/photo.png1700001000').digest('binary');
    const legacy = Buffer.from(md5, 'binary')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    expect(new URL(signBunnyCdnUrl(data)).searchParams.get('token')).toBe(legacy);
  });

  it('returns the same URL within a window and a new one after it', () => {
    const first = signBunnyCdnUrl(data);

    expect(signBunnyCdnUrl({ ...data, now: 1_700_000_400 })).toBe(first);
    expect(signBunnyCdnUrl({ ...data, now: 1_700_000_401 })).not.toBe(first);
  });
});
