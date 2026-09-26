import { CreateOf, DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { StorageObjectPlacementMeta } from '@common/domain/interfaces/storage-object.meta.interface';
import { Either } from '@sweet-monads/either';

export interface FileSaveAndPlace {
  file: CreateOf<NestStorage.File>;
  storageObject?: StorageObjectPlacementMeta;
}

// A video's Bunny guid lives on the video row and is never copied onto its backing file, so the
// relation has to be read to know what a deleted file row leaves behind at the provider.
export type FileWithVideo = NestStorage.File & { video?: NestStorage.Video };

export abstract class FileRepository extends DatabaseRepository<
  NestStorage.File,
  NestStorage.FileQuery
> {
  abstract saveAndPlaceOne(createData: FileSaveAndPlace): Promise<Either<Error, NestStorage.File>>;
  abstract saveAndPlaceMany(items: FileSaveAndPlace[]): Promise<Either<Error, NestStorage.File[]>>;
  /** Files whose storage object was deleted — the media half of the deleted-tree sweep. */
  abstract getManyInDeletedStorageObjects(limit: number): Promise<FileWithVideo[]>;
}
