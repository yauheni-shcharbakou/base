import { CreateOf, DatabaseRepository } from '@backend/common';
import { NestAuth } from '@backend/proto';

export interface TempCodeQuery extends NestAuth.TempCodeQuery {
  expiredBefore?: Date;
  isActive?: boolean;
}

export interface TempCodeCreate extends Omit<CreateOf<NestAuth.TempCode>, 'userId'> {}

export abstract class TempCodeRepository extends DatabaseRepository<
  NestAuth.TempCode,
  TempCodeQuery,
  TempCodeCreate
> {}
