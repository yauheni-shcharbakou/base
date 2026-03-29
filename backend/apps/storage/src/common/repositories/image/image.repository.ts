import { DatabaseRepository } from '@backend/persistence';
import { GrpcImageQuery, GrpcImage, GrpcImageCreate } from '@backend/grpc';

export const IMAGE_REPOSITORY = Symbol('ImageRepository');

export interface ImageRepository extends DatabaseRepository<
  GrpcImage,
  GrpcImageQuery,
  ImageCreate
> {}

export interface ImageCreate extends GrpcImageCreate {
  file: string;
  userId: string;
  uploadId: string;
}
