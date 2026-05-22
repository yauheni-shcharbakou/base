import { CreateOf, DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';

export abstract class VideoRepository extends DatabaseRepository<
  NestStorage.Video,
  NestStorage.VideoQuery,
  VideoCreate
> {}

export interface VideoCreate extends Omit<
  CreateOf<NestStorage.Video>,
  'fileId' | 'duration' | 'views'
> {
  file: string;
}
