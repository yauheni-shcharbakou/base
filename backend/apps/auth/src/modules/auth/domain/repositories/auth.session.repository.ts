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

export abstract class AuthSessionRepository extends DatabaseRepository<
  AuthSession,
  AuthSessionQuery,
  AuthSessionCreate
> {}
