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
   * Runs `work` in one transaction that first takes the tree lock of `userId`'s tree. Writes that
   * check the tree first (a create, a move, a visibility change, a deletion) run one at a time per
   * owner, so what `work` checked still holds when its write lands. A `left` from `work` rolls the
   * transaction back. Different owners never wait for each other: no `parent` link crosses two trees.
   */
  abstract withTreeLock<T>(
    userId: string,
    work: () => Promise<Either<Error, T>>,
  ): Promise<Either<Error, T>>;
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
  /**
   * The file, image or video a new leaf would place, if `userId` owns it. Another user's media
   * comes back as `undefined`, like a missing one.
   */
  abstract getMediaToPlace(
    query: StorageObjectMediaQuery,
  ): Promise<Either<Error, StorageObjectMedia | undefined>>;
}

export type StorageObjectLeafType = Exclude<
  NestStorage.StorageObjectType,
  NestStorage.StorageObjectType.FOLDER
>;

export interface StorageObjectMediaQuery {
  type: StorageObjectLeafType;
  id: string;
  userId: string;
}

export interface StorageObjectMedia {
  /** The file row behind the media, which is the media itself for a plain file. */
  fileId: string;
  /** A storage object already references it, live or deleted. */
  isPlaced: boolean;
  /** Plain files only: it backs an image or a video, and that is what gets placed. */
  isBacking: boolean;
  /** The file row's status, an image's and a video's included. */
  uploadStatus: NestStorage.FileUploadStatus;
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

// No `userId`: an object never changes owner. The tree lock is keyed by the owner and read before
// the lock is taken, which is only safe because of that.
export interface StorageObjectUpdate extends NestStorage.StorageObjectUpdate {
  set?: NestStorage.StorageObjectUpdate['set'] & {
    parent?: string;
    isDeleted?: boolean;
  };
}
