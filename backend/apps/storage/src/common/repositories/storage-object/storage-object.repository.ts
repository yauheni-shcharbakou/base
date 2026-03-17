import { DatabaseRepository } from '@backend/persistence';
import {
  GrpcStorageObject,
  GrpcStorageObjectCreate,
  GrpcStorageObjectQuery,
  GrpcStorageObjectUpdate,
} from '@backend/grpc';

export const STORAGE_OBJECT_REPOSITORY = Symbol('StorageObjectRepository');

export interface StorageObjectRepository extends DatabaseRepository<
  GrpcStorageObject,
  GrpcStorageObjectQuery,
  StorageObjectCreate,
  StorageObjectUpdate
> {}

export interface StorageObjectCreate extends Omit<GrpcStorageObjectCreate, 'parent'> {
  userId: string;
  folderPath?: string;
  parent?: string;
}

export interface StorageObjectUpdate extends GrpcStorageObjectUpdate {
  set?: GrpcStorageObjectUpdate['set'] & {
    parent?: string;
    folderPath?: string;
  };
}
