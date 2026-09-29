import { PgMapper } from '@backend/pg';
import { ObjectQuery } from '@mikro-orm/core';
import { AuthSession } from '@modules/auth/domain/interfaces/auth.interface';
import { AuthSessionQuery } from '@modules/auth/domain/repositories/auth.session.repository';
import { PgAuthSessionEntity } from '../entities/pg.auth-session.entity';

export class PgAuthSessionMapper extends PgMapper<
  PgAuthSessionEntity,
  AuthSession,
  AuthSessionQuery
> {
  transformQuery({
    expiredBefore,
    ...rest
  }: Partial<AuthSessionQuery>): ObjectQuery<PgAuthSessionEntity> {
    const result = super.transformQuery(rest);

    if (expiredBefore) {
      result.expiredAt = { $lte: expiredBefore };
    }

    return result;
  }
}
