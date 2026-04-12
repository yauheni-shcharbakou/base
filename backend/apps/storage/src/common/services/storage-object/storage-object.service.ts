import {
  GrpcStorageObjectCreate,
  GrpcStorageObjectExistsFolderRequest,
  GrpcStorageObjectQuery,
  GrpcStorageObjectUpdate,
  GrpcStorageObject,
  GrpcStorageObjectManyMetadata,
  GrpcStorageObjectGetFoldersRequest,
  GrpcStorageObjectGetFoldersItem,
} from '@backend/grpc';
import { CrudService } from '@backend/persistence';
import { StorageObjectUpdateParentEvent } from '@backend/transport';
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
  onUpdateParent(event: StorageObjectUpdateParentEvent): Promise<void>;
  createRootFolder(userId: string): Promise<void>;
  isExistsFolder(request: GrpcStorageObjectExistsFolderRequest, userId: string): Promise<boolean>;
  getFolders(
    request: GrpcStorageObjectGetFoldersRequest,
    userId: string,
  ): Promise<GrpcStorageObjectGetFoldersItem[]>;
}

export interface StorageObjectCreateManyFiles extends GrpcStorageObjectManyMetadata {
  userId: string;
  files: Pick<GrpcStorageObjectCreate, 'name' | 'type' | 'file' | 'image' | 'video'>[];
}
