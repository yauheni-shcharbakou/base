import { CreateOf, DatabaseRepository } from '@backend/persistence';
import { GrpcFile, GrpcFileQuery } from '@backend/grpc';

export const FILE_REPOSITORY = Symbol('FileRepository');

export interface FileRepository extends DatabaseRepository<GrpcFile, GrpcFileQuery, FileCreate> {}

export interface FileCreate extends Omit<CreateOf<GrpcFile>, 'extension' | 'uploadStatus'> {}
