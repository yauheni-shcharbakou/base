import { CreateOf, DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { FileMeta } from '@common/domain/interfaces/file.meta.interface';
import { StorageObjectPlacementMeta } from '@common/domain/interfaces/storage-object.meta.interface';
import { Either } from '@sweet-monads/either';

export interface VideoCreate extends Omit<
  CreateOf<NestStorage.Video>,
  'fileId' | 'duration' | 'views'
> {
  file: string;
}

export interface VideoSaveAndPlace {
  video: Omit<VideoCreate, 'file'>;
  file: FileMeta;
  storageObject?: StorageObjectPlacementMeta;
}

export abstract class VideoRepository extends DatabaseRepository<
  NestStorage.Video,
  NestStorage.VideoQuery,
  VideoCreate
> {
  abstract saveAndPlaceOne(
    createData: VideoSaveAndPlace,
  ): Promise<Either<Error, NestStorage.Video>>;
  abstract saveAndPlaceMany(
    items: VideoSaveAndPlace[],
  ): Promise<Either<Error, NestStorage.Video[]>>;
}
