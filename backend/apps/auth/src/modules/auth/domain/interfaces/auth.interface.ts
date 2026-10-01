import type { AuthTokenPayloadParsed } from '@backend/common';
import type { NestCommon } from '@backend/proto';

export type { AuthTokenPayload, AuthTokenPayloadParsed } from '@backend/common';

/**
 * A refresh token names its session twice: `sid` is the session's id, the same for its whole life,
 * and the standard `jti` is the session's current `tokenId`, new with every refresh. A token
 * without both is refused.
 */
export interface AuthRefreshTokenPayloadParsed extends AuthTokenPayloadParsed {
  sid: string;
  jti: string;
}

/** What a refresh token is signed for: see `AuthRefreshTokenPayloadParsed`. */
export interface AuthRefreshTokenSession {
  sessionId: string;
  tokenId: string;
}

/**
 * A signed-in session: what makes its refresh tokens valid. Logout deletes it, and a refresh token
 * whose session is gone is refused, however long its own `exp` still runs.
 */
export interface AuthSession extends NestCommon.Entity {
  userId: string;
  /** The `jti` of the session's one valid refresh token; each refresh replaces it. */
  tokenId: string;
  /** The `exp` of the session's latest refresh token; a refresh moves it forward. */
  expiredAt: Date;
}
