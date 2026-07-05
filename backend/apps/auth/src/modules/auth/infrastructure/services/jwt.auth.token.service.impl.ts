import { NestAuth } from '@backend/proto';
import {
  AuthTokenPayload,
  AuthTokenPayloadParsed,
} from '@modules/auth/domain/interfaces/auth.interface';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { JwtConfig } from '../configs/jwt.config';

@Injectable()
export class JwtAuthTokenServiceImpl implements AuthTokenService {
  constructor(
    private readonly configService: ConfigService<JwtConfig>,
    private readonly jwtService: JwtService,
  ) {}

  parseAccessTokenPayload(token: string): Either<Error, AuthTokenPayloadParsed> {
    try {
      const options = this.configService.get('accessToken', { infer: true });

      const payload = this.jwtService.verify<AuthTokenPayloadParsed>(
        token,
        _.pick(options, ['secret', 'issuer']),
      );

      if (!payload) {
        throw new Error();
      }

      return right(payload);
    } catch (error) {
      return left(new Error('Invalid access token'));
    }
  }

  parseRefreshTokenPayload(token: string): Either<Error, AuthTokenPayloadParsed> {
    try {
      const options = this.configService.get('refreshToken', { infer: true });

      const payload = this.jwtService.verify<AuthTokenPayloadParsed>(
        token,
        _.pick(options, ['secret', 'issuer']),
      );

      if (!payload?.refresh) {
        throw new Error();
      }

      return right(payload);
    } catch (error) {
      return left(new Error('Invalid refresh token'));
    }
  }

  async generateTokens(payload: AuthTokenPayload): Promise<Either<Error, NestAuth.AuthTokens>> {
    try {
      const accessTokenOptions = this.configService.get('accessToken', { infer: true });
      const refreshTokenOptions = this.configService.get('refreshToken', { infer: true });

      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(payload, accessTokenOptions),
        this.jwtService.signAsync({ ...payload, refresh: true }, refreshTokenOptions),
      ]);

      const accessTokenPayload = this.parseAccessTokenPayload(accessToken);
      const refreshTokenPayload = this.parseRefreshTokenPayload(refreshToken);

      if (accessTokenPayload.isLeft() || refreshTokenPayload.isLeft()) {
        throw new Error();
      }

      return right({
        accessToken: {
          value: accessToken,
          expiredAt: new Date(accessTokenPayload.value.exp * 1000),
        },
        refreshToken: {
          value: refreshToken,
          expiredAt: new Date(refreshTokenPayload.value.exp * 1000),
        },
      });
    } catch (error) {
      return left(new Error('Error during tokens generation'));
    }
  }
}
