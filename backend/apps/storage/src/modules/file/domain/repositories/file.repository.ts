import { CreateOf, DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { Either } from '@sweet-monads/either';

export interface FileSaveAndPlace {
  file: CreateOf<NestStorage.File>;
  storageObject?: NestStorage.StorageMeta;
}

export abstract class FileRepository extends DatabaseRepository<
  NestStorage.File,
  NestStorage.FileQuery
> {
  abstract saveAndPlaceOne(createData: FileSaveAndPlace): Promise<Either<Error, NestStorage.File>>;
  abstract saveAndPlaceMany(items: FileSaveAndPlace[]): Promise<Either<Error, NestStorage.File[]>>;
}
