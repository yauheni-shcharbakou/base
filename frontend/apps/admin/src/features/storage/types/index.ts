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
 * What the multi-upload hook needs from a created record: when the credentials it came with stop
 * working. `expires` is unix seconds for both the Bunny Stream TUS signature and the pre-signed
 * Bunny Storage PUT. Which selected file it answers is its position in the create-many result.
 */
export type CreatedUploadEntity = BrowserCommon.IdField & {
  upload: { expires: string };
};

export type StorageUploadItem = {
  file: File;
  // The item's key in the upload map. Browser-only: the create call is answered by position, so
  // this never reaches the server.
  key: string;
  // The record the create call returned, credentials included. Its presence is what lets a retry
  // skip creation — until those credentials expire, when the item is created afresh.
  entity?: CreatedUploadEntity;
};

/** A page of a folder, as the folder browser asks for it. */
export type FolderContentRequest = {
  folderId: string;
  // The folder's owner, when an earlier listing told it. Without it the action reads the folder
  // first: the admin `getFolderContent` scopes by owner as well as by folder.
  userId?: string;
  sortBy: BrowserStorage.StorageObjectSortField;
  sortOrder: BrowserCommon.Sort;
  page: number;
  pageSize: number;
  search?: string;
  types: BrowserStorage.StorageObjectType[];
};
