import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GrpcAuthData, GrpcAuthLogin, GrpcAuthMe, GrpcAuthRefresh, GrpcUser } from '@backend/grpc';
import { Either } from '@sweet-monads/either';

export const AUTH_SERVICE = Symbol('AuthService');

export interface AuthService {
  login(data: GrpcAuthLogin): Promise<Either<NotFoundException | ForbiddenException, GrpcAuthData>>;
  refreshToken(
    data: GrpcAuthRefresh,
  ): Promise<Either<NotFoundException | ForbiddenException, GrpcAuthData>>;
  getUserByToken(
    data: GrpcAuthMe,
  ): Promise<Either<NotFoundException | ForbiddenException, GrpcUser>>;
}
