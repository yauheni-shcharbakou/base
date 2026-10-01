import { CreateOf, DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { StorageObjectPlacementMeta } from '@common/domain/interfaces/storage-object.meta.interface';
import { Either } from '@sweet-monads/either';

export interface FileSaveAndPlace {
  file: CreateOf<NestStorage.File>;
  storageObject?: StorageObjectPlacementMeta;
}

// A video's Bunny guid lives on the video row and is never copied onto its backing file, and an
// image's preview key on the image row, so the relations have to be read to know what a deleted
// file row leaves behind at the provider.
export type FileWithMedia = NestStorage.File & {
  video?: NestStorage.Video;
  image?: NestStorage.Image;
};

export abstract class FileRepository extends DatabaseRepository<
  NestStorage.File,
  NestStorage.FileQuery
> {
  abstract saveAndPlaceOne(createData: FileSaveAndPlace): Promise<Either<Error, NestStorage.File>>;
  abstract saveAndPlaceMany(items: FileSaveAndPlace[]): Promise<Either<Error, NestStorage.File[]>>;
  /** Files whose storage object was deleted — the media half of the deleted-tree sweep. */
  abstract getManyInDeletedStorageObjects(limit: number): Promise<FileWithMedia[]>;
  /**
   * Files of one owner, placed or not. An image's and a video's backing file carries the media's
   * owner, so this reaches every media the user holds.
   */
  abstract getManyByOwner(userId: string, limit: number): Promise<FileWithMedia[]>;
  /**
   * Turns FAILED every upload still PENDING that was created before `createdBefore`, and answers
   * how many. One statement, conditional on the status: a confirmation or a provider callback that
   * lands meanwhile is never overwritten.
   */
  abstract failPendingBefore(createdBefore: Date): Promise<Either<Error, number>>;
  /** Every user that owns at least one file. */
  abstract getOwnerIds(): Promise<string[]>;
  /**
   * READY plain files of these types, READY since before `readyBefore`, with neither a preview nor
   * a failure recorded — what the document sweep takes on, oldest first.
   */
  abstract getManyWithoutPreview(
    mimeTypes: string[],
    readyBefore: Date,
    limit: number,
  ): Promise<NestStorage.File[]>;
  /** Records the file's preview key, unless one is set already: true when this call set it. */
  abstract setPreview(id: string, previewProviderId: string): Promise<Either<Error, boolean>>;
  /** Marks the file as one no retry can make a preview for, unless it has one. */
  abstract markPreviewFailed(id: string): Promise<Either<Error, boolean>>;
}
