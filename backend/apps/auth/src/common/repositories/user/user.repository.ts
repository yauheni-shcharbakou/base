import { CreateOf, DatabaseRepository, UpdateOf } from '@backend/persistence';
import { NotFoundException } from '@nestjs/common';
import { User, UserQuery } from '@backend/grpc';
import { Either } from '@sweet-monads/either';
import { UserInternal } from 'common/interfaces/user.interface';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface UserRepository extends DatabaseRepository<
  User,
  UserQuery,
  UserCreateInternal,
  UserUpdateInternal
> {
  getOneInternal(query?: Partial<UserQuery>): Promise<Either<NotFoundException, UserInternal>>;
}

export interface UserCreateInternal extends CreateOf<UserInternal> {}

export interface UserUpdateInternal extends UpdateOf<UserInternal> {}
