import { NestAuth } from '@backend/proto';
import { Either } from '@sweet-monads/either';
import { AuthTokenPayload, AuthTokenPayloadParsed } from '../interfaces/auth.interface';

export abstract class AuthTokenService {
  abstract parseAccessTokenPayload(token: string): Either<Error, AuthTokenPayloadParsed>;
  abstract parseRefreshTokenPayload(token: string): Either<Error, AuthTokenPayloadParsed>;
  abstract generateTokens(payload: AuthTokenPayload): Promise<Either<Error, NestAuth.AuthTokens>>;
}
