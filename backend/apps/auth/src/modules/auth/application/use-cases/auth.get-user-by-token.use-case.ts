import { NestAuth } from '@backend/proto';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';

@Injectable()
export class AuthGetUserByTokenUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: AuthTokenService,
  ) {}

  async execute(data: NestAuth.AuthMe): Promise<Either<Error, NestAuth.User>> {
    const payload = this.tokenService.parseAccessTokenPayload(data.accessToken);

    if (payload.isLeft()) {
      return left(new ForbiddenException('Access token invalid'));
    }

    return this.userRepository.getById(payload.value.id);
  }
}
