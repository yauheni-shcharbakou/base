import { DatabaseRepository } from '@backend/persistence';
import { GrpcFile, GrpcFileCreate, GrpcFileQuery, GrpcFileUpdate } from '@backend/grpc';

export const FILE_REPOSITORY = Symbol('FileRepository');

export interface FileRepository extends DatabaseRepository<
  GrpcFile,
  GrpcFileQuery,
  GrpcFileCreate,
  GrpcFileUpdate
> {}
