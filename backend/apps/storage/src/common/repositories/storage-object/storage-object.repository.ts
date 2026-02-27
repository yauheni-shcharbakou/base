import {
  CreateOf,
  DatabaseRepository,
  DatabaseRepositoryGetList,
  DatabaseRepositoryGetListRes,
  UpdateOf,
} from '@backend/persistence';
import {
  GrpcStorageObject,
  GrpcStorageObjectPopulated,
  GrpcStorageObjectQuery,
} from '@backend/grpc';

export const STORAGE_OBJECT_REPOSITORY = Symbol('StorageObjectRepository');

export interface StorageObjectRepository extends DatabaseRepository<
  GrpcStorageObject,
  GrpcStorageObjectQuery
> {
  // getListPopulated(
  //   request: DatabaseRepositoryGetList<GrpcStorageObjectQuery>,
  // ): Promise<DatabaseRepositoryGetListRes<GrpcStorageObjectPopulated>>;
}
