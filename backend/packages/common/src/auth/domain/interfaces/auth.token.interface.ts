import { NestAuth } from '@backend/proto';
import { AuthTokenAudience } from '../enums';

export interface AuthTokenPayload {
  id: string;
  login: string;
  role: NestAuth.UserRole;
}

export interface AuthTokenPayloadParsed extends AuthTokenPayload {
  // Access and refresh tokens no longer differ by signing key alone (access is RS256,
  // refresh is HS256), so the kind is stated as the standard `aud` claim. It is set and
  // enforced through the jwt `audience` option, not by hand.
  aud: AuthTokenAudience;
  iat: number;
  exp: number;
  iss: string;
}
