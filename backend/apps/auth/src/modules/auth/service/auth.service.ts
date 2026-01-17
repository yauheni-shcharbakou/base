import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthData, AuthLogin, AuthMe, AuthRefresh, AuthTokens, User } from '@packages/grpc.nest';
import { Either } from '@sweet-monads/either';

export const AUTH_SERVICE = Symbol('AuthService');

export interface AuthService {
  login(data: AuthLogin): Promise<Either<NotFoundException | ForbiddenException, AuthData>>;
  refreshToken(
    data: AuthRefresh,
  ): Promise<Either<NotFoundException | ForbiddenException, AuthTokens>>;
  getUserByToken(data: AuthMe): Promise<Either<NotFoundException | ForbiddenException, User>>;
}
