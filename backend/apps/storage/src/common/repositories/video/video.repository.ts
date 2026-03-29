import { CreateOf, DatabaseRepository } from '@backend/persistence';
import { GrpcVideo, GrpcVideoCreate, GrpcVideoQuery } from '@backend/grpc';

export const VIDEO_REPOSITORY = Symbol('VideoRepository');

export interface VideoRepository extends DatabaseRepository<
  GrpcVideo,
  GrpcVideoQuery,
  VideoCreate
> {}

export interface VideoCreate extends Omit<CreateOf<GrpcVideo>, 'fileId' | 'duration' | 'views'> {
  file: string;
}
