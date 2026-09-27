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
  /**
   * The ids of every folder under `parent`. A failed walk is a `left`, never an empty set, which
   * would read as "no descendants" and let a folder be moved into its own subtree.
   */
  abstract getAllChildrenIds(parent: string): Promise<Either<Error, Set<string>>>;
  /**
   * Runs `work` in one transaction that first takes the tree lock. Tree writes that check the tree
   * first (a move, a visibility change, a deletion) run one at a time, so what `work` checked still
   * holds when its write lands. A `left` from `work` rolls the transaction back.
   */
  abstract withTreeLock<T>(work: () => Promise<Either<Error, T>>): Promise<Either<Error, T>>;
  /**
   * Updates the object, and when it is a folder whose `isPublic` changes, writes the new value over
   * its whole subtree — in one transaction, so a folder and its content never disagree.
   */
  abstract updateAndCascadePublic(
    id: string,
    update: StorageObjectUpdate,
  ): Promise<Either<Error, StorageObject>>;
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
  isFolder: boolean;
}

export interface StorageObjectUpdate extends NestStorage.StorageObjectUpdate {
  set?: NestStorage.StorageObjectUpdate['set'] & {
    parent?: string;
    isDeleted?: boolean;
  };
}
