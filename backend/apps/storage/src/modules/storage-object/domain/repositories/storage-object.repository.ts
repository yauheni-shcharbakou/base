import { DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { Either } from '@sweet-monads/either';
import { StorageObject } from '../entities/storage-object.interface';

export abstract class StorageObjectRepository extends DatabaseRepository<
  StorageObject,
  StorageObjectQuery,
  StorageObjectCreate,
  StorageObjectUpdate
> {
  abstract getAllChildrenIds(parent: string): Promise<Set<string>>;
  /** Marks the object and everything under it deleted, in one statement. Returns the row count. */
  abstract markDeletedWithDescendants(id: string): Promise<Either<Error, number>>;
  /** Hard-deletes deleted folders that no longer have children. Returns the row count. */
  abstract deleteEmptyDeletedFolders(): Promise<Either<Error, number>>;
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
