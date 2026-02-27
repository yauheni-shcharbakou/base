import { DatabaseRepository } from '@backend/persistence';
import { GrpcImageQuery, GrpcImage } from '@backend/grpc';

export const IMAGE_REPOSITORY = Symbol('ImageRepository');

export interface ImageRepository extends DatabaseRepository<GrpcImage, GrpcImageQuery> {}
