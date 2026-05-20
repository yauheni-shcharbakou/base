import { DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { StorageObject } from '../entities/storage-object.interface';

export abstract class StorageObjectRepository extends DatabaseRepository<
  StorageObject,
  StorageObjectQuery,
  StorageObjectCreate,
  StorageObjectUpdate
> {
  abstract getAllChildrenIds(parent: string): Promise<Set<string>>;
}

export interface StorageObjectQuery extends Partial<NestStorage.StorageObjectQuery> {
  nameStartsWith?: string;
  isFolder?: boolean;
  excludeIds?: string[];
  isDeleted?: boolean;
}

export interface StorageObjectCreate extends NestStorage.StorageObjectCreate {
  folderPath?: string;
  isFolder: boolean;
}

export interface StorageObjectUpdate extends NestStorage.StorageObjectUpdate {
  set?: NestStorage.StorageObjectUpdate['set'] & {
    parent?: string;
    folderPath?: string;
    isDeleted?: boolean;
  };
}
