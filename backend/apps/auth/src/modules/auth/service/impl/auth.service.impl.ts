import { ForbiddenException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthData, AuthLogin, AuthMe, AuthRefresh, AuthTokens, User } from '@packages/grpc.nest';
import { Either, left, right } from '@sweet-monads/either';
import { IAuthJwtPayload } from 'common/interfaces/auth.interface';
import { UserInternal } from 'common/interfaces/user.interface';
import { USER_REPOSITORY, UserRepository } from 'common/repositories/user/user.repository';
import { Config } from 'config';
import { pbkdf2, timingSafeEqual } from 'crypto';
import _ from 'lodash';
import { AuthService } from 'modules/auth/service/auth.service';

export class AuthServiceImpl implements AuthService {
  private readonly logger = new Logger(AuthServiceImpl.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Config>,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  private async generateTokens(payload: IAuthJwtPayload): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow('jwt.refreshToken.secret', { infer: true }),
        expiresIn: this.configService.getOrThrow('jwt.refreshToken.signOptions.expiresIn', {
          infer: true,
        }),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private parsePayload(token: string, isRefresh = false): IAuthJwtPayload | undefined {
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

  private async validatePassword(password: string, user: UserInternal): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      pbkdf2(password, user.salt, 25_000, 512, 'sha256', (error, hashBuffer) => {
        if (error) {
          this.logger.error(error.message, error.stack);
          resolve(false);
        }

        const savedBuffer = Buffer.from(user.hash, 'hex');
        resolve(timingSafeEqual(hashBuffer, savedBuffer));
      });
    });
  }

  async login(data: AuthLogin): Promise<Either<NotFoundException | ForbiddenException, AuthData>> {
    const user = await this.userRepository.getOne({ email: data.login });

    if (user.isLeft()) {
      return left(user.value);
    }

    const isPasswordValid = await this.validatePassword(data.password, user.value);

    if (!isPasswordValid) {
      return left(new ForbiddenException('Invalid password'));
    }

    return right({
      user: _.pick(user.value, ['_id', 'email', 'role']),
      tokens: await this.generateTokens({ id: user.value._id, login: user.value.email }),
    });
  }

  async refreshToken(
    data: AuthRefresh,
  ): Promise<Either<NotFoundException | ForbiddenException, AuthTokens>> {
    const payload = this.parsePayload(data.refreshToken, true);

    if (!payload) {
      return left(new ForbiddenException('Refresh token invalid'));
    }

    const user = await this.userRepository.getById(payload.id);

    if (user.isLeft()) {
      return left(user.value);
    }

    return right(await this.generateTokens({ id: user.value._id, login: user.value.email }));
  }

  async getUserByToken(
    data: AuthMe,
  ): Promise<Either<NotFoundException | ForbiddenException, User>> {
    const payload = this.parsePayload(data.accessToken);

    if (!payload) {
      return left(new ForbiddenException('Access token invalid'));
    }

    const user = await this.userRepository.getById(payload.id);

    if (user.isLeft()) {
      return left(user.value);
    }

    return right(_.pick(user.value, ['_id', 'email', 'role']));
  }
}
