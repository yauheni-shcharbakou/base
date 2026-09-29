import { NestAuth } from '@backend/proto';
import { AuthSessionRepository } from '@modules/auth/domain/repositories/auth.session.repository';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

@Injectable()
export class AuthRefreshTokenUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: AuthTokenService,
    private readonly sessionRepository: AuthSessionRepository,
  ) {}

  /**
   * A refresh token is valid while its signature and `exp` hold **and** its session still exists —
   * a logout deletes it. The new refresh token keeps the session's `jti` rather than rotating it:
   * the admin's middleware refreshes from parallel requests, and a rotation would refuse all but
   * the first of them, logging the user out.
   */
  async execute(data: NestAuth.AuthRefresh): Promise<Either<Error, NestAuth.AuthData>> {
    const payload = this.tokenService.parseRefreshTokenPayload(data.refreshToken);

    if (payload.isLeft()) {
      return left(this.invalidToken());
    }

    const session = await this.sessionRepository.getOne({ tokenId: payload.value.jti });

    if (session.isLeft() || session.value.userId !== payload.value.id) {
      return left(this.invalidToken());
    }

    const user = await this.userRepository.getById(payload.value.id);

    if (user.isLeft()) {
      return left(user.value);
    }

    const tokens = await this.tokenService.generateTokens(
      {
        id: user.value.id,
        login: user.value.email,
        role: user.value.role,
      },
      session.value.tokenId,
    );

    if (tokens.isLeft()) {
      return left(new InternalServerErrorException('Tokens generation failed'));
    }

    // A logout that landed since the read above wins: the row is gone, and so are these tokens.
    const extended = await this.sessionRepository.updateById(session.value.id, {
      set: { expiredAt: tokens.value.refreshToken.expiredAt },
    });

    if (extended.isLeft()) {
      return left(this.invalidToken());
    }

    return right({ user: user.value, tokens: tokens.value });
  }

  private invalidToken() {
    return new ForbiddenException('Refresh token invalid');
  }
}
