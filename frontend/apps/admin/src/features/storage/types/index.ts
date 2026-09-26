import type { BrowserCommon, BrowserStorage } from '@packages/proto';
import type { BaseRecord } from '@refinedev/core';

/**
 * How a selected file's bytes leave the browser — always straight to the provider, with the
 * credentials the create call returned: Bunny Stream over TUS for video, a pre-signed Bunny Storage
 * PUT plus a confirmation for files and images. The Next server never carries the bytes.
 *
 * Named with the `Action` suffix so Next's `'use client'` serializable-props check (71007) accepts
 * it as a component prop — it runs on the client and is not a server action. The entity stays
 * loosely typed because the hooks are generic over the record their create call returned.
 */
export type UploadFileAction = (
  file: File,
  entity: BaseRecord,
  options?: { onProgress?: (percent: number) => void },
) => Promise<void>;

export type StorageData = Partial<
  Pick<BrowserStorage.StorageObjectCreate, 'parent' | 'isPublic' | 'name'>
>;

/**
 * What the multi-upload hook needs from a created record: which selected file it answers, and when
 * the credentials it came with stop working. `expires` is unix seconds for both the Bunny Stream
 * TUS signature and the pre-signed Bunny Storage PUT.
 */
export type CreatedUploadEntity = BrowserCommon.IdField & {
  uploadId: string;
  upload: { expires: string };
};

export type StorageUploadItem = {
  file: File;
  uploadId: string;
  // The record the create call returned, credentials included. Its presence is what lets a retry
  // skip creation — until those credentials expire, when the item is created afresh.
  entity?: CreatedUploadEntity;
};
