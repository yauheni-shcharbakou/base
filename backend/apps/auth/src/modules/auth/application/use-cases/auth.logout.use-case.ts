import { NestAuth } from '@backend/proto';
import { AuthSessionRepository } from '@modules/auth/domain/repositories/auth.session.repository';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

@Injectable()
export class AuthLogoutUseCase {
  constructor(
    private readonly tokenService: AuthTokenService,
    private readonly sessionRepository: AuthSessionRepository,
  ) {}

  /**
   * Ends the session the refresh token belongs to — by its `sid`, so any token the session ever
   * issued will do, a replaced one included. Idempotent: a token that no longer verifies, or whose
   * session is already gone, has nothing left to revoke, so it succeeds too. Only a failed delete
   * is an error.
   */
  async execute(data: NestAuth.AuthLogout): Promise<Either<Error, void>> {
    const payload = this.tokenService.parseRefreshTokenPayload(data.refreshToken);

    if (payload.isLeft()) {
      return right(undefined);
    }

    const deleted = await this.sessionRepository.deleteById(payload.value.sid);

    if (deleted.isLeft() && !(deleted.value instanceof NotFoundException)) {
      return left(deleted.value);
    }

    return right(undefined);
  }
}
