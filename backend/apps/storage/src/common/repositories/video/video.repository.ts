import { DatabaseRepository } from '@backend/persistence';
import { GrpcVideo, GrpcVideoQuery } from '@backend/grpc';

export const VIDEO_REPOSITORY = Symbol('VideoRepository');

export interface VideoRepository extends DatabaseRepository<GrpcVideo, GrpcVideoQuery> {}
