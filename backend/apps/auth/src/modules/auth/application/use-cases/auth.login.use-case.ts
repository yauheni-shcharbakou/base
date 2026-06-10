import { NestAuth } from '@backend/proto';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { CryptoService } from '@modules/crypto/domain/services/crypto.service';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

@Injectable()
export class AuthLoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: AuthTokenService,
    private readonly cryptoService: CryptoService,
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
