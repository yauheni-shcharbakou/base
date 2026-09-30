import { NestAuth } from '@backend/proto';
import { Either } from '@sweet-monads/either';
import {
  AuthRefreshTokenPayloadParsed,
  AuthRefreshTokenSession,
  AuthTokenPayload,
  AuthTokenPayloadParsed,
} from '../interfaces/auth.interface';

export abstract class AuthTokenService {
  abstract parseAccessTokenPayload(token: string): Either<Error, AuthTokenPayloadParsed>;
  abstract parseRefreshTokenPayload(token: string): Either<Error, AuthRefreshTokenPayloadParsed>;
  /** The refresh token carries `session` as its `sid` and `jti` claims. */
  abstract generateTokens(
    payload: AuthTokenPayload,
    session: AuthRefreshTokenSession,
  ): Promise<Either<Error, NestAuth.AuthTokens>>;
}
