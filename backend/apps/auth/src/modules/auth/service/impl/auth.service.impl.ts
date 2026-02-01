import { ForbiddenException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  GrpcAuthData,
  GrpcAuthLogin,
  GrpcAuthMe,
  GrpcAuthRefresh,
  GrpcAuthTokens,
  GrpcUser,
} from '@backend/grpc';
import { Either, left, right } from '@sweet-monads/either';
import { AuthJwtPayload, AuthJwtPayloadParsed } from 'common/interfaces/auth.interface';
import { CRYPTO_SERVICE, CryptoService } from 'common/modules/crypto/crypto.service';
import { USER_REPOSITORY, UserRepository } from 'common/repositories/user/user.repository';
import { Config } from 'config';
import { AuthService } from 'modules/auth/service/auth.service';

export class AuthServiceImpl implements AuthService {
  private readonly logger = new Logger(AuthServiceImpl.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Config>,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(CRYPTO_SERVICE) private readonly cryptoService: CryptoService,
  ) {}

  private parsePayload(token: string, isRefresh = false): AuthJwtPayloadParsed | undefined {
    try {
      return this.jwtService.verify(
        token,
        isRefresh
          ? this.configService.getOrThrow('jwt.refreshToken.secret', { infer: true })
          : undefined,
      );
    } catch (error) {
      return;
    }
  }

  private async generateTokens(payload: AuthJwtPayload): Promise<GrpcAuthTokens> {
    const refreshSecret = this.configService.getOrThrow('jwt.refreshToken.secret', { infer: true });

    const refreshExpiresIn = this.configService.getOrThrow(
      'jwt.refreshToken.signOptions.expiresIn',
      { infer: true },
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, { secret: refreshSecret, expiresIn: refreshExpiresIn }),
    ]);

    const accessTokenPayload = this.parsePayload(accessToken);
    const refreshTokenPayload = this.parsePayload(accessToken, true);

    return {
      accessToken: {
        value: accessToken,
        expireDate: new Date(accessTokenPayload.exp * 1000),
      },
      refreshToken: {
        value: refreshToken,
        expireDate: new Date(refreshTokenPayload.exp * 1000),
      },
    };
  }

  async login(
    data: GrpcAuthLogin,
  ): Promise<Either<NotFoundException | ForbiddenException, GrpcAuthData>> {
    const user = await this.userRepository.getOneInternal({ email: data.login });

    console.log('login', user);

    if (user.isLeft()) {
      return left(user.value);
    }

    const isPasswordValid = await this.cryptoService.compare(data.password, user.value.hash);

    if (!isPasswordValid) {
      return left(new ForbiddenException('Invalid password'));
    }

    return right({
      user: user.value,
      tokens: await this.generateTokens({ id: user.value.id, login: user.value.email }),
    });
  }

  async refreshToken(
    data: GrpcAuthRefresh,
  ): Promise<Either<NotFoundException | ForbiddenException, GrpcAuthData>> {
    const payload = this.parsePayload(data.refreshToken, true);

    if (!payload) {
      return left(new ForbiddenException('Refresh token invalid'));
    }

    const user = await this.userRepository.getById(payload.id);

    if (user.isLeft()) {
      return left(user.value);
    }

    return right({
      user: user.value,
      tokens: await this.generateTokens({ id: user.value.id, login: user.value.email }),
    });
  }

  async getUserByToken(
    data: GrpcAuthMe,
  ): Promise<Either<NotFoundException | ForbiddenException, GrpcUser>> {
    const payload = this.parsePayload(data.accessToken);

    if (!payload) {
      return left(new ForbiddenException('Access token invalid'));
    }

    const user = await this.userRepository.getById(payload.id);

    if (user.isLeft()) {
      return left(user.value);
    }

    return right(user.value);
  }
}
