import { AuthTokenPayloadParsed } from '@backend/common';
import { Either } from '@sweet-monads/either';

export abstract class TokenService {
  // Synchronous by contract: gRPC stream guards must not defer the handler,
  // otherwise the incoming message stream stalls (see GrpcAccessStreamGuard).
  abstract verifyAccessToken(token: string): Either<Error, AuthTokenPayloadParsed>;
}
