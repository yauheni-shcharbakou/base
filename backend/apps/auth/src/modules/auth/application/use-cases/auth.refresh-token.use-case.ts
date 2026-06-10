import { NestAuth } from '@backend/proto';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

@Injectable()
export class AuthRefreshTokenUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: AuthTokenService,
  ) {}

  async execute(data: NestAuth.AuthRefresh): Promise<Either<Error, NestAuth.AuthData>> {
    const payload = this.tokenService.parseRefreshTokenPayload(data.refreshToken);

    if (payload.isLeft()) {
      return left(new ForbiddenException('Refresh token invalid'));
    }

    const user = await this.userRepository.getById(payload.value.id);

    if (user.isLeft()) {
      return left(user.value);
    }

    const tokens = await this.tokenService.generateTokens({
      id: user.value.id,
      login: user.value.email,
    });

    if (tokens.isLeft()) {
      return left(new InternalServerErrorException('Tokens generation failed'));
    }

    return right({ user: user.value, tokens: tokens.value });
  }
}
