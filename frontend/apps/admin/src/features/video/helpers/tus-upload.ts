import { ONE_MB_BYTES } from '@/common/constants';
import type { BrowserStorage } from '@packages/proto';
import { Upload } from 'tus-js-client';

// tus-js-client defaults to a single unbounded request, which throws away the whole point of a
// resumable upload.
const TUS_CHUNK_SIZE_BYTES = 20 * ONE_MB_BYTES;

type Options = {
  onProgress?: (percent: number) => void;
  // Aborts the upload: its requests stop, and it is rejected. What Bunny holds of it goes with the
  // video, which whoever cancels deletes.
  signal?: AbortSignal;
};

const CANCELLED_MESSAGE = 'The upload was cancelled';

/**
 * Uploads a file straight from the browser to Bunny Stream with the credentials the create call
 * returned. The bytes never touch our servers; the outcome arrives through Bunny's status webhook.
 */
export const uploadViaTus = (
  file: File,
  credentials: BrowserStorage.VideoTusUpload,
  { onProgress, signal }: Options = {},
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(CANCELLED_MESSAGE));
      return;
    }

    // A completed upload of a non-empty file always PATCHes at least once, so the absence of a PATCH
    // is proof the bytes never left the browser. Counting writes rather than watching `onProgress`
    // is the whole point: a tus upload that merely *finds* the data already at the provider reports
    // 100% from its very first progress event, which is exactly how the resume bug below passed for
    // success. Progress cannot tell "sent it" from "someone else already had it"; the request can.
    let isWritten = false;

    const upload = new Upload(file, {
      endpoint: credentials.endpoint,
      chunkSize: TUS_CHUNK_SIZE_BYTES,
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      // No resume across page loads, deliberately. tus keys its stored upload URLs by a fingerprint
      // of `(name, type, size, lastModified, endpoint)` — the credentials are not part of it, and
      // `endpoint` is the same `tusupload` for every video. So re-uploading the same file matched
      // the *previous* video's URL, and since that upload was already complete, Bunny reported it
      // as finished and no byte ever reached the new `videoId`: the row sat `PENDING` forever while
      // the UI reported success. Resume inside this `Upload` still works — tus HEADs the URL its
      // own POST returned — and that is the only resume this design can have, because every create
      // call mints a fresh `videoId` and signature that no stored URL can correspond to.
      storeFingerprintForResuming: false,
      // Bunny validates these on every POST/HEAD/PATCH and rejects any value that differs from
      // what was signed, so they are forwarded exactly as the server produced them.
      headers: {
        AuthorizationSignature: credentials.signature,
        AuthorizationExpire: credentials.expires,
        LibraryId: credentials.libraryId,
        VideoId: credentials.videoId,
      },
      metadata: {
        filetype: credentials.filetype,
        title: credentials.title,
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress?.(bytesTotal ? (bytesUploaded * 100) / bytesTotal : 0);
      },
      onBeforeRequest: (req) => {
        if (req.getMethod() === 'PATCH') {
          isWritten = true;
        }
      },
      onSuccess: () => {
        // `file.size` guards the one honest case: a zero-byte file completes on the POST alone.
        if (file.size && !isWritten) {
          reject(
            new Error('The provider reported the upload as complete without receiving any data'),
          );
          return;
        }

        resolve();
      },
      onError: (error) => reject(error),
    });

    signal?.addEventListener(
      'abort',
      () => {
        // An aborted tus upload calls neither `onSuccess` nor `onError`: the rejection is ours.
        upload.abort().catch(() => undefined);
        reject(new Error(CANCELLED_MESSAGE));
      },
      { once: true },
    );

    upload.start();
  });
};
