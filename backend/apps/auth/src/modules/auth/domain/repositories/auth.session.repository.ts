import { DatabaseRepository, QueryOf } from '@backend/common';
import { AuthSession } from '../interfaces/auth.interface';

export interface AuthSessionQuery extends QueryOf<AuthSession> {
  expiredBefore?: Date;
}

export interface AuthSessionCreate {
  user: string;
  tokenId: string;
  expiredAt: Date;
}

export interface AuthSessionRotation {
  tokenId: string;
  expiredAt: Date;
}

export abstract class AuthSessionRepository extends DatabaseRepository<
  AuthSession,
  AuthSessionQuery,
  AuthSessionCreate
> {
  /**
   * Replaces the session's `tokenId` only while it still is `currentTokenId`, as one atomic write.
   * `false` when it no longer was — another refresh spent the token first, or a logout deleted the
   * session. A failure is thrown, never reported as `false`.
   */
  abstract rotateToken(
    id: string,
    currentTokenId: string,
    next: AuthSessionRotation,
  ): Promise<boolean>;

  /**
   * Ends every session of the user, as one statement, and answers how many there were. A refresh
   * already past its read loses `rotateToken` to it. A failure is thrown.
   */
  abstract deleteByUser(userId: string): Promise<number>;
}
