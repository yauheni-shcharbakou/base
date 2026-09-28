import { DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { FileMeta } from '@common/domain/interfaces/file.meta.interface';
import { StorageObjectPlacementMeta } from '@common/domain/interfaces/storage-object.meta.interface';
import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

export interface ImageCreate extends NestStorage.ImageCreate {
  file: string;
  userId: string;
}

export interface ImageSaveAndPlace {
  image: Omit<ImageCreate, 'file'>;
  file: FileMeta;
  storageObject?: StorageObjectPlacementMeta;
}

export abstract class ImageRepository extends DatabaseRepository<
  NestStorage.Image,
  NestStorage.ImageQuery,
  ImageCreate
> {
  abstract saveAndPlaceOne(
    createData: ImageSaveAndPlace,
  ): Promise<Either<Error, NestStorage.Image>>;
  abstract saveAndPlaceMany(
    items: ImageSaveAndPlace[],
  ): Promise<Either<Error, NestStorage.Image[]>>;
  /** Deletes the image together with the file row it owns — see the implementation for why. */
  abstract deleteWithFile(id: string): Promise<Either<NotFoundException, NestStorage.Image>>;
}
