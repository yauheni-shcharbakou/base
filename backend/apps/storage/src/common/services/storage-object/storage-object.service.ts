import {
  GrpcBooleanResult,
  GrpcStorageObjectCreate,
  GrpcStorageObjectExistsFolderRequest,
  GrpcStorageObjectQuery,
  GrpcStorageObjectUpdate,
  GrpcStorageObject,
  GrpcStorageObjectManyMetadata,
} from '@backend/grpc';
import { CrudService } from '@backend/persistence';
import { StorageObjectUpdateIsPublicEvent } from '@backend/transport';
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
  createManyFiles(
    createData: StorageObjectCreateManyFiles,
  ): Promise<Either<Error, GrpcStorageObject[]>>;
  onUpdateIsPublic(event: StorageObjectUpdateIsPublicEvent): Promise<void>;
  createRootFolder(userId: string): Promise<void>;
  isExistsFolder(
    request: GrpcStorageObjectExistsFolderRequest,
    userId: string,
  ): Promise<GrpcBooleanResult>;
}

export interface StorageObjectCreateManyFiles extends GrpcStorageObjectManyMetadata {
  userId: string;
  files: Pick<GrpcStorageObjectCreate, 'name' | 'type' | 'file' | 'image' | 'video'>[];
}
