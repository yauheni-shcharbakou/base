import { NestAuth } from '@backend/proto';
import { Either } from '@sweet-monads/either';
import {
  AuthRefreshTokenPayloadParsed,
  AuthTokenPayload,
  AuthTokenPayloadParsed,
} from '../interfaces/auth.interface';

export abstract class AuthTokenService {
  abstract parseAccessTokenPayload(token: string): Either<Error, AuthTokenPayloadParsed>;
  abstract parseRefreshTokenPayload(token: string): Either<Error, AuthRefreshTokenPayloadParsed>;
  /** `sessionTokenId` goes into the refresh token as its `jti` — see `AuthSession.tokenId`. */
  abstract generateTokens(
    payload: AuthTokenPayload,
    sessionTokenId: string,
  ): Promise<Either<Error, NestAuth.AuthTokens>>;
}
