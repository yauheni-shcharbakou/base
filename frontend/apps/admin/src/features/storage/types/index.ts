import type { BrowserStorage } from '@packages/proto';

export type StorageData = Partial<
  Pick<BrowserStorage.StorageObjectCreate, 'parent' | 'isPublic' | 'name'>
>;

export type StorageUploadItem = {
  file: File;
  uploadId: string;
  entityId?: string;
};
