import {
  toDownloadResponseInit,
  toUpstreamHeaders,
} from '@/features/storage/helpers/download-proxy';

describe('toUpstreamHeaders', () => {
  it('passes on the range pair and nothing of the admin session', () => {
    const upstream = toUpstreamHeaders(
      new Headers({
        cookie: 'accessToken=jwt; refreshToken=jwt',
        authorization: 'Bearer jwt',
        host: 'admin.example.com',
        'x-forwarded-for': '10.0.0.5',
        'user-agent': 'browser',
        'if-none-match': '"etag"',
        range: 'bytes=100-',
        'if-range': '"etag"',
      }),
    );

    expect(Array.from(upstream.keys()).sort()).toEqual(['accept-encoding', 'if-range', 'range']);
    expect(upstream.get('range')).toBe('bytes=100-');
    expect(upstream.get('if-range')).toBe('"etag"');
  });

  it('passes on the referer as its origin, for the pull zone’s allowed-referrer check', () => {
    const upstream = toUpstreamHeaders(
      new Headers({ referer: 'https://admin.example.com/storage/videos/show/01JQ?tab=1' }),
    );

    expect(upstream.get('referer')).toBe('https://admin.example.com/');
  });

  it('drops a referer that is not a URL', () => {
    const upstream = toUpstreamHeaders(new Headers({ referer: 'not a url' }));

    expect(upstream.has('referer')).toBe(false);
  });

  it('asks for the unencoded body even when the browser accepts gzip', () => {
    const upstream = toUpstreamHeaders(new Headers({ 'accept-encoding': 'gzip, br' }));

    expect(upstream.get('accept-encoding')).toBe('identity');
  });
});

describe('toDownloadResponseInit', () => {
  it('keeps a partial response partial', () => {
    const init = toDownloadResponseInit(
      {
        status: 206,
        headers: new Headers({
          'content-type': 'video/mp4',
          'content-length': '900',
          'content-range': 'bytes 100-999/1000',
          'accept-ranges': 'bytes',
          etag: '"etag"',
          'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT',
          'set-cookie': 'cdn=1',
          server: 'BunnyCDN',
        }),
      },
      'video.mp4',
    );

    expect(init.status).toBe(206);
    expect(Object.fromEntries(Array.from(init.headers.entries()))).toEqual({
      'accept-ranges': 'bytes',
      'content-disposition': 'attachment; filename="video.mp4"',
      'content-length': '900',
      'content-range': 'bytes 100-999/1000',
      'content-type': 'video/mp4',
      etag: '"etag"',
      'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT',
    });
  });

  it('falls back to a binary type and sends only what the CDN sent', () => {
    const init = toDownloadResponseInit({ status: 200, headers: new Headers() }, 'file.bin');

    expect(init.status).toBe(200);
    expect(Object.fromEntries(Array.from(init.headers.entries()))).toEqual({
      'content-disposition': 'attachment; filename="file.bin"',
      'content-type': 'application/octet-stream',
    });
  });
});
