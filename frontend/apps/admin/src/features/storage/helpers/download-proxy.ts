// What a download route passes on to the signed CDN URL. An allow-list, because the browser's own
// request carries the admin's session cookies, `Host` and `X-Forwarded-*` — none of the CDN's
// business, and the signed URL needs none of them. `Range` and `If-Range` are what a browser sends
// to resume a download; the conditional-GET pair (`If-None-Match`, `If-Modified-Since`) is left out,
// because an attachment is never revalidated from the HTTP cache, and a 304 would need a path of
// its own.
const FORWARDED_REQUEST_HEADERS = ['range', 'if-range'];

// What the browser needs back to see a partial response for what it is, and to resume it later:
// `If-Range` can only be sent with a validator the first response carried.
const FORWARDED_RESPONSE_HEADERS = [
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
];

// The origin alone: the admin page's path is not the CDN's business either.
const getRefererOrigin = (referer: string | null): string | null => {
  if (!referer) {
    return null;
  }

  try {
    return `${new URL(referer).origin}/`;
  } catch {
    return null;
  }
};

/**
 * The headers of the request to the CDN. `Accept-Encoding: identity` keeps the body the file's own
 * bytes: fetch would otherwise ask for gzip and decompress on the fly, and the `Content-Length` and
 * `Content-Range` passed back would then count bytes of an encoding the browser never gets.
 *
 * The browser's `Referer` goes on as its origin. The Stream pull zone blocks a request with no
 * referrer ("Block direct url file access") and checks the rest against its allowed referrers
 * (`backend/apps/storage/README.md`), so without it every video download is a 403. Signed token
 * auth reads the URL alone, and IP validation the connection's own address — no header of ours.
 */
export const toUpstreamHeaders = (requestHeaders: Headers): Headers => {
  const headers = new Headers({ 'accept-encoding': 'identity' });

  FORWARDED_REQUEST_HEADERS.forEach((name) => {
    const value = requestHeaders.get(name);

    if (value !== null) {
      headers.set(name, value);
    }
  });

  const refererOrigin = getRefererOrigin(requestHeaders.get('referer'));

  if (refererOrigin) {
    headers.set('referer', refererOrigin);
  }

  return headers;
};

/**
 * The status and headers of the download route's answer to a successful CDN response: its status
 * as is — 206 for a range, 200 otherwise — and the headers that describe the body, plus the
 * attachment name.
 */
export const toDownloadResponseInit = (
  upstream: Pick<Response, 'status' | 'headers'>,
  fileName: string,
): { status: number; headers: Headers } => {
  const headers = new Headers({
    'content-disposition': `attachment; filename="${fileName}"`,
    'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
  });

  FORWARDED_RESPONSE_HEADERS.forEach((name) => {
    const value = upstream.headers.get(name);

    if (value !== null) {
      headers.set(name, value);
    }
  });

  return { status: upstream.status, headers };
};
