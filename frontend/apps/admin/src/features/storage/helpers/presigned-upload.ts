import { completeFileUpload } from '@/features/storage/actions';
import type { BrowserStorage } from '@packages/proto';
import axios from 'axios';

type Options = {
  onProgress?: (percent: number) => void;
};

/**
 * Uploads a file straight from the browser to Bunny Storage with the pre-signed PUT the create call
 * returned, then confirms it. Bunny Storage reports nothing back on its own, so the confirmation —
 * where the backend checks the stored size against the declared one — is what turns the row READY.
 *
 * A plain axios instance on purpose: `internalHttpClient` is bound to the Next `/api` base URL.
 * `Content-Type` and the length are signed, so the body goes as is, with exactly that type.
 */
export const uploadViaPresignedUrl = async (
  file: File,
  upload: BrowserStorage.FilePresignedUpload,
  fileId: string,
  { onProgress }: Options = {},
): Promise<void> => {
  await axios.put(upload.url, file, {
    headers: { 'Content-Type': upload.contentType },
    timeout: 0,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    onUploadProgress: ({ loaded, total }) => {
      onProgress?.((loaded * 100) / (total || file.size));
    },
  });

  const response = await completeFileUpload(fileId);

  if ('error' in response) {
    throw new Error(response.error);
  }
};
