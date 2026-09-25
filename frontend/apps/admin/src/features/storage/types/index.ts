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

export type StorageUploadItem = {
  file: File;
  uploadId: string;
  entityId?: string;
  // The record the create call returned. Kept alongside the id because a retry skips creation,
  // and the upload needs the credentials that came with the entity, not just its id.
  entity?: BrowserCommon.IdField & { uploadId: string };
};
