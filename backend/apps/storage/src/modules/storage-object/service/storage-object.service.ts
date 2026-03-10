import {
  GrpcStorageObject,
  GrpcStorageObjectCreate,
  GrpcStorageObjectQuery,
  GrpcStorageObjectUpdate,
} from '@backend/grpc';
import { CrudService } from '@backend/persistence';
import { Either } from '@sweet-monads/either';

export const STORAGE_OBJECT_SERVICE = Symbol('StorageObjectService');

export interface StorageObjectService extends CrudService<
  GrpcStorageObject,
  GrpcStorageObjectQuery,
  GrpcStorageObjectCreate,
  GrpcStorageObjectUpdate
> {
  createOne(
    request: GrpcStorageObjectCreate,
    userId: string,
  ): Promise<Either<Error, GrpcStorageObject>>;
  onFileDelete(file: string): Promise<void>;
}
