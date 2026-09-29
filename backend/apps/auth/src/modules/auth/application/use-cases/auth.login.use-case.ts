import { NestAuth } from '@backend/proto';
import { AuthSessionRepository } from '@modules/auth/domain/repositories/auth.session.repository';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { CryptoService } from '@modules/crypto/domain/services/crypto.service';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthLoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: AuthTokenService,
    private readonly cryptoService: CryptoService,
    private readonly sessionRepository: AuthSessionRepository,
  ) {}

  async execute(data: NestAuth.AuthLogin): Promise<Either<Error, NestAuth.AuthData>> {
    const user = await this.userRepository.getOneInternal({ email: data.login });

    if (user.isLeft()) {
      return left(user.value);
    }

    const isPasswordValid = await this.cryptoService.compare(data.password, user.value.hash);

    if (!isPasswordValid) {
      return left(new ForbiddenException('Invalid password'));
    }

    // Every sign-in opens a session of its own, so a logout ends this one and no other.
    const tokenId = randomUUID();

    const tokens = await this.tokenService.generateTokens(
      {
        id: user.value.id,
        login: user.value.email,
        role: user.value.role,
      },
      tokenId,
    );

    if (tokens.isLeft()) {
      return left(new InternalServerErrorException('Tokens generation failed'));
    }

    const session = await this.sessionRepository.saveOne({
      user: user.value.id,
      tokenId,
      expiredAt: tokens.value.refreshToken.expiredAt,
    });

    if (session.isLeft()) {
      return left(new InternalServerErrorException('Session creation failed'));
    }

    return right({ user: user.value, tokens: tokens.value });
  }
}
