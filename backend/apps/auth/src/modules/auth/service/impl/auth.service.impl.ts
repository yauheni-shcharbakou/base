import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
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
import {
  TEMP_CODE_REPOSITORY,
  TempCodeRepository,
} from 'common/repositories/temp-code/temp-code.repository';
import { USER_REPOSITORY, UserRepository } from 'common/repositories/user/user.repository';
import { CRYPTO_SERVICE, CryptoService } from 'common/services/crypto/crypto.service';
import { Config } from 'config';
import _ from 'lodash';
import { AuthService } from 'modules/auth/service/auth.service';

export class AuthServiceImpl implements AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Config>,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    // @Inject(TEMP_CODE_REPOSITORY) private readonly tempCodeRepository: TempCodeRepository,
    @Inject(CRYPTO_SERVICE) private readonly cryptoService: CryptoService,
  ) {}

  private getJwtConfiguration() {
    return this.configService.get('jwt', { infer: true });
  }

  private parsePayload(token: string, isRefresh = false): AuthJwtPayloadParsed | undefined {
    try {
      const configuration = this.getJwtConfiguration();
      const options = isRefresh ? configuration.refreshToken : configuration.accessToken;

      const payload = this.jwtService.verify<AuthJwtPayloadParsed>(
        token,
        _.pick(options, ['secret', 'issuer']),
      );

      if (isRefresh && !payload.refresh) {
        return;
      }

      return payload;
    } catch (error) {
      return;
    }
  }

  private async generateTokens(payload: AuthJwtPayload): Promise<GrpcAuthTokens> {
    const configuration = this.getJwtConfiguration();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, configuration.accessToken),
      this.jwtService.signAsync({ ...payload, refresh: true }, configuration.refreshToken),
    ]);

    const accessTokenPayload = this.parsePayload(accessToken);
    const refreshTokenPayload = this.parsePayload(refreshToken, true);

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

  // async generateStreamCode(data: GrpcAuthMe): Promise<Either<Error, GrpcAuthStreamCode>> {
  //   const payload = this.parsePayload(data.accessToken);
  //
  //   if (!payload) {
  //     return left(new ForbiddenException('Access token invalid'));
  //   }
  //
  //   const isUserExists = await this.userRepository.isExistsById(payload.id);
  //
  //   if (!isUserExists) {
  //     return left(new NotFoundException('User not found'));
  //   }
  //
  //   const expiresInMinutes = this.configService.get('tempCode.expiresInMinutes', { infer: true });
  //
  //   const tempCode = await this.tempCodeRepository.saveOne({
  //     user: payload.id,
  //     isActive: true,
  //     expiredAt: moment().add(expiresInMinutes, 'minutes').toDate(),
  //     code: monotonicFactory()(),
  //   });
  //
  //   if (tempCode.isLeft()) {
  //     return left(tempCode.value);
  //   }
  //
  //   return right({ code: tempCode.value.code, expireDate: tempCode.value.expiredAt });
  // }
}
