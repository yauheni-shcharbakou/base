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
  StorageObjectQuery,
  StorageObjectCreate,
  StorageObjectUpdate
> {}

export interface StorageObjectQuery extends GrpcStorageObjectQuery {
  nameStratsWith?: string;
}

export interface StorageObjectCreate extends GrpcStorageObjectCreate {
  userId: string;
  folderPath?: string;
}

export interface StorageObjectUpdate extends GrpcStorageObjectUpdate {
  set?: GrpcStorageObjectUpdate['set'] & {
    parent?: string;
    folderPath?: string;
  };
}
