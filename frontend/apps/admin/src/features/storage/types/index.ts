import { GrpcStorageObjectCreate } from '@packages/grpc';

export type StorageData = Partial<Pick<GrpcStorageObjectCreate, 'parent' | 'isPublic' | 'name'>>;

export type StorageUploadItem = {
  file: File;
  uploadId: string;
  entityId?: string;
};
