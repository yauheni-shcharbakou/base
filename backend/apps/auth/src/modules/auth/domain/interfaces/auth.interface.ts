import type { AuthTokenPayloadParsed } from '@backend/common';
import type { NestCommon } from '@backend/proto';

export type { AuthTokenPayload, AuthTokenPayloadParsed } from '@backend/common';

/**
 * A refresh token names its session in the standard `jti` claim; one without it (issued before
 * sessions existed) is refused.
 */
export interface AuthRefreshTokenPayloadParsed extends AuthTokenPayloadParsed {
  jti: string;
}

/**
 * A signed-in session: what makes its refresh tokens valid. Logout deletes it, and a refresh token
 * whose session is gone is refused, however long its own `exp` still runs.
 */
export interface AuthSession extends NestCommon.Entity {
  userId: string;
  /** The `jti` every refresh token of this session carries. */
  tokenId: string;
  /** The `exp` of the session's latest refresh token; a refresh moves it forward. */
  expiredAt: Date;
}
