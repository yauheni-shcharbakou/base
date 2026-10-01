import { AuthTokenPayloadParsed } from '@backend/common';
import { TokenService } from '@common/domain/services/token.service';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Either, left, right } from '@sweet-monads/either';
import { JwtConfig } from '../configs/jwt.config';

@Injectable()
export class JwtTokenServiceImpl implements TokenService {
  constructor(
    private readonly configService: ConfigService<JwtConfig>,
    private readonly jwtService: JwtService,
  ) {}

  verifyAccessToken(token: string): Either<Error, AuthTokenPayloadParsed> {
    try {
      const options = this.configService.getOrThrow('accessToken', { infer: true });

      // `audience` makes jwt reject anything that is not an access token — with access
      // on RS256 and refresh on HS256, the key alone no longer separates the two kinds.
      const payload = this.jwtService.verify<AuthTokenPayloadParsed>(token, {
        publicKey: options.publicKey,
        algorithms: [options.algorithm],
        issuer: options.issuer,
        audience: options.audience,
      });

      if (!payload) {
        throw new Error();
      }

      return right(payload);
    } catch (error) {
      return left(new ForbiddenException('Access token invalid'));
    }
  }
}
