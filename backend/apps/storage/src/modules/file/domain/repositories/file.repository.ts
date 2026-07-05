import { CreateOf, DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { StorageObjectPlacementMeta } from '@common/domain/interfaces/storage-object.meta.interface';
import { Either } from '@sweet-monads/either';

export interface FileSaveAndPlace {
  file: CreateOf<NestStorage.File>;
  storageObject?: StorageObjectPlacementMeta;
}

export abstract class FileRepository extends DatabaseRepository<
  NestStorage.File,
  NestStorage.FileQuery
> {
  abstract saveAndPlaceOne(createData: FileSaveAndPlace): Promise<Either<Error, NestStorage.File>>;
  abstract saveAndPlaceMany(items: FileSaveAndPlace[]): Promise<Either<Error, NestStorage.File[]>>;
}
