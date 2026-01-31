import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { User, UserCreate, UserQuery, UserUpdate } from '@backend/grpc';
import { Either } from '@sweet-monads/either';

export const USER_SERVICE = Symbol('UserService');

export interface UserService {
  create(data: UserCreate): Promise<Either<InternalServerErrorException, User>>;
  updateOne(query: UserQuery, updateData: UserUpdate): Promise<Either<NotFoundException, User>>;
}
