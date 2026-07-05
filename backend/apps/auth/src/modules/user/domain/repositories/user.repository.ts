import { CreateOf, DatabaseRepository, UpdateOf } from '@backend/common';
import { NestAuth } from '@backend/proto';
import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { User } from '../interfaces/user.interface';

export interface UserCreate extends CreateOf<User> {}

export interface UserUpdate extends UpdateOf<User> {}

export abstract class UserRepository extends DatabaseRepository<
  NestAuth.User,
  NestAuth.UserQuery,
  UserCreate,
  UserUpdate
> {
  abstract getOneInternal(
    query?: Partial<NestAuth.UserQuery>,
  ): Promise<Either<NotFoundException, User>>;
}
