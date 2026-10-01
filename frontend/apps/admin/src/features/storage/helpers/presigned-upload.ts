import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import { completeFileUpload } from '@/features/storage/actions';
import type { BrowserStorage } from '@packages/proto';
import axios from 'axios';

type Options = {
  onProgress?: (percent: number) => void;
  // Aborts the PUT: the upload is rejected, and nothing is confirmed.
  signal?: AbortSignal;
};

/**
 * Sends a file straight from the browser to Bunny Storage with the pre-signed PUT the create call
 * returned — the bytes only: the row stays PENDING until the upload is confirmed.
 *
 * A plain axios instance on purpose: `internalHttpClient` is bound to the Next `/api` base URL.
 * `Content-Type` and the length are signed, so the body goes as is, with exactly that type.
 */
export const putToPresignedUrl = async (
  file: File,
  upload: BrowserStorage.FilePresignedUpload,
  { onProgress, signal }: Options = {},
): Promise<void> => {
  await axios.put(upload.url, file, {
    headers: { 'Content-Type': upload.contentType },
    signal,
    timeout: 0,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    onUploadProgress: ({ loaded, total }) => {
      onProgress?.((loaded * 100) / (total || file.size));
    },
  });
};

/**
 * Uploads a file with its pre-signed PUT, then confirms it. Bunny Storage reports nothing back on
 * its own, so the confirmation — where the backend checks the stored size against the declared one
 * — is what turns the row READY. The upload queue confirms many at once (`completeFileUploads`).
 */
export const uploadViaPresignedUrl = async (
  file: File,
  upload: BrowserStorage.FilePresignedUpload,
  fileId: string,
  options: Options = {},
): Promise<void> => {
  await putToPresignedUrl(file, upload, options);
  unwrapActionResult(await completeFileUpload(fileId));
};
