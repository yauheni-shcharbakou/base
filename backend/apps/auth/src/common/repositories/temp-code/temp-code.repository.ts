import { CreateOf, DatabaseRepository } from '@backend/persistence';
import { GrpcBaseQuery, GrpcTempCode } from '@backend/grpc';

export const TEMP_CODE_REPOSITORY = Symbol('TempCodeRepository');

export interface TempCodeRepository extends DatabaseRepository<
  GrpcTempCode,
  TempCodeQuery,
  TempCodeCreate
> {}

export interface TempCodeQuery extends GrpcBaseQuery {
  expiredBefore?: Date;
  isActive?: boolean;
}

export interface TempCodeCreate extends Omit<CreateOf<GrpcTempCode>, 'userId'> {
  user: string;
}
