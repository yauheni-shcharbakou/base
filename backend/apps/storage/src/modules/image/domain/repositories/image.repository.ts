import { DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';

export abstract class ImageRepository extends DatabaseRepository<
  NestStorage.Image,
  NestStorage.ImageQuery,
  ImageCreate
> {}

export interface ImageCreate extends NestStorage.ImageCreate {
  file: string;
  userId: string;
  uploadId: string;
}
