import { CreateOf, DatabaseRepository, UpdateOf } from '@backend/persistence';
import { NotFoundException } from '@nestjs/common';
import { GrpcUser, GrpcUserQuery } from '@backend/grpc';
import { Either } from '@sweet-monads/either';
import { User } from 'common/interfaces/user.interface';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface UserRepository extends DatabaseRepository<
  GrpcUser,
  GrpcUserQuery,
  UserCreate,
  UserUpdate
> {
  getOneInternal(query?: Partial<GrpcUserQuery>): Promise<Either<NotFoundException, User>>;
}

export interface UserCreate extends CreateOf<User> {}

export interface UserUpdate extends UpdateOf<User> {}
