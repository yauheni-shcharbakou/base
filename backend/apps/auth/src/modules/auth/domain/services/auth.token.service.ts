import { NestAuth } from '@backend/proto';
import { Either } from '@sweet-monads/either';

export interface AuthTokenPayload {
  id: string;
  login: string;
}

export interface AuthTokenPayloadParsed extends AuthTokenPayload {
  refresh?: true;
  iat: number;
  exp: number;
  iss: string;
}

export abstract class AuthTokenService {
  abstract parseAccessTokenPayload(token: string): Either<Error, AuthTokenPayloadParsed>;
  abstract parseRefreshTokenPayload(token: string): Either<Error, AuthTokenPayloadParsed>;
  abstract generateTokens(payload: AuthTokenPayload): Promise<Either<Error, NestAuth.AuthTokens>>;
}
