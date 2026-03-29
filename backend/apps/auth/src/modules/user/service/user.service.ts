import { CrudService } from '@backend/persistence';
import { GrpcUser, GrpcUserCreate, GrpcUserQuery, GrpcUserUpdate } from '@backend/grpc';

export const USER_SERVICE = Symbol('UserService');

export interface UserService extends CrudService<
  GrpcUser,
  GrpcUserQuery,
  GrpcUserCreate,
  GrpcUserUpdate
> {}
