import { NestAuth } from '@backend/proto';
import { AuthSessionRepository } from '@modules/auth/domain/repositories/auth.session.repository';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthRefreshTokenUseCase {
  private readonly logger = new Logger(AuthRefreshTokenUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: AuthTokenService,
    private readonly sessionRepository: AuthSessionRepository,
  ) {}

  /**
   * Spends the refresh token: it is valid only while it is its session's current one, and the new
   * tokens replace it. A token spent twice — an old one presented again, or two refreshes racing
   * with the same one — means a copy is in someone else's hands, and nothing tells the two holders
   * apart, so the session ends for both. The admin spends each token once (`SingleFlight` in its
   * `AuthService`); a second admin process would not share that, and would end sessions here.
   */
  async execute(data: NestAuth.AuthRefresh): Promise<Either<Error, NestAuth.AuthData>> {
    const payload = this.tokenService.parseRefreshTokenPayload(data.refreshToken);

    if (payload.isLeft()) {
      return left(this.invalidToken());
    }

    const { sid, jti } = payload.value;
    const session = await this.sessionRepository.getById(sid);

    if (session.isLeft() || session.value.userId !== payload.value.id) {
      return left(this.invalidToken());
    }

    if (session.value.tokenId !== jti) {
      return left(await this.endReusedSession(sid));
    }

    const user = await this.userRepository.getById(payload.value.id);

    if (user.isLeft()) {
      return left(user.value);
    }

    const nextTokenId = randomUUID();

    const tokens = await this.tokenService.generateTokens(
      {
        id: user.value.id,
        login: user.value.email,
        role: user.value.role,
      },
      { sessionId: sid, tokenId: nextTokenId },
    );

    if (tokens.isLeft()) {
      return left(new InternalServerErrorException('Tokens generation failed'));
    }

    const rotated = await this.sessionRepository.rotateToken(sid, jti, {
      tokenId: nextTokenId,
      expiredAt: tokens.value.refreshToken.expiredAt,
    });

    // Lost to a refresh that spent the same token a moment earlier — or to a logout, which leaves
    // nothing to end.
    if (!rotated) {
      return left(await this.endReusedSession(sid));
    }

    return right({ user: user.value, tokens: tokens.value });
  }

  private async endReusedSession(sessionId: string) {
    this.logger.warn(`Refresh token spent twice, ending session ${sessionId}`);

    const deleted = await this.sessionRepository.deleteById(sessionId);

    // Gone already is fine; a session that should have ended and did not is worth a line.
    if (deleted.isLeft() && !(deleted.value instanceof NotFoundException)) {
      this.logger.error(`Failed to end session ${sessionId}`, deleted.value);
    }

    return this.invalidToken();
  }

  private invalidToken() {
    return new ForbiddenException('Refresh token invalid');
  }
}
