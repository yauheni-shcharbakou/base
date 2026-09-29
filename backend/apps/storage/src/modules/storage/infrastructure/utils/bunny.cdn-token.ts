import { createHash } from 'node:crypto';

/**
 * The expiry of a signed read URL, rounded up to the next multiple of its lifetime. A URL lives
 * between one and two lifetimes, and every URL signed for a path within the same window is the same
 * string — so a browser reuses what it fetched instead of taking each signature for a new object.
 */
export const getAlignedExpiry = (
  ttlSeconds: number,
  now: number = Math.floor(Date.now() / 1000),
): number => {
  if (!(ttlSeconds > 0)) {
    throw new RangeError(`A signed URL needs a positive lifetime, got ${ttlSeconds}s`);
  }

  return Math.ceil((now + ttlSeconds) / ttlSeconds) * ttlSeconds;
};

export interface BunnyCdnUrlData {
  /** The pull zone, `https://<zone>.b-cdn.net`. */
  baseUrl: string;
  /** The object's path, leading slash included. */
  path: string;
  privateKey: string;
  expiresInMinutes: number;
  /** Unix seconds; the current time when absent. */
  now?: number;
}

/**
 * A pull zone URL signed with Bunny's basic token authentication, `base64url(md5(key + path +
 * expires))`. The query string is not signed, so a caller may append Optimizer parameters such as
 * `width`. No client address goes in (ADR-0025).
 */
export const signBunnyCdnUrl = ({
  baseUrl,
  path,
  privateKey,
  expiresInMinutes,
  now,
}: BunnyCdnUrlData): string => {
  const expires = getAlignedExpiry(Math.round(expiresInMinutes * 60), now);
  const token = createHash('md5').update(`${privateKey}${path}${expires}`).digest('base64url');
  const url = new URL(baseUrl + path);

  url.searchParams.set('token', token);
  url.searchParams.set('expires', expires.toString());

  return url.toString();
};
