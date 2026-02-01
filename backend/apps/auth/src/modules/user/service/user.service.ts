import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { GrpcUser, GrpcUserCreate, GrpcUserQuery, GrpcUserUpdate } from '@backend/grpc';
import { Either } from '@sweet-monads/either';

export const USER_SERVICE = Symbol('UserService');

export interface UserService {
  create(data: GrpcUserCreate): Promise<Either<InternalServerErrorException, GrpcUser>>;
  updateOne(
    query: GrpcUserQuery,
    updateData: GrpcUserUpdate,
  ): Promise<Either<NotFoundException, GrpcUser>>;
}
