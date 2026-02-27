import { GrpcStorageObject, GrpcStorageObjectQuery } from '@backend/grpc';
import { CrudService } from '@backend/persistence';

export const STORAGE_OBJECT_SERVICE = Symbol('StorageObjectService');

export interface StorageObjectService extends CrudService<
  GrpcStorageObject,
  GrpcStorageObjectQuery
> {
  onFileDelete(file: string): Promise<void>;
}
