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
> {
  getAllChildrenIds(parent: string): Promise<Set<string>>;
}

export interface StorageObjectQuery extends Partial<GrpcStorageObjectQuery> {
  nameStratsWith?: string;
  isFolder?: boolean;
  excludeIds?: string[];
}

export interface StorageObjectCreate extends GrpcStorageObjectCreate {
  userId: string;
  folderPath?: string;
  isFolder: boolean;
}

export interface StorageObjectUpdate extends GrpcStorageObjectUpdate {
  set?: GrpcStorageObjectUpdate['set'] & {
    parent?: string;
    folderPath?: string;
  };
}
