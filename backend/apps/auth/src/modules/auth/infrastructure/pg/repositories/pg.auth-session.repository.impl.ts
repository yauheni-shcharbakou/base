import { PgRepositoryImpl } from '@backend/pg';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { AuthSession } from '@modules/auth/domain/interfaces/auth.interface';
import {
  AuthSessionCreate,
  AuthSessionQuery,
  AuthSessionRepository,
  AuthSessionRotation,
} from '@modules/auth/domain/repositories/auth.session.repository';
import { PgAuthSessionEntity } from '../entities/pg.auth-session.entity';
import { PgAuthSessionMapper } from '../mappers/pg.auth-session.mapper';

export class PgAuthSessionRepositoryImpl
  extends PgRepositoryImpl<PgAuthSessionEntity, AuthSession, AuthSessionQuery, AuthSessionCreate>
  implements AuthSessionRepository
{
  protected readonly resourceName = 'Session';

  constructor(
    @InjectRepository(PgAuthSessionEntity)
    protected readonly repository: EntityRepository<PgAuthSessionEntity>,
  ) {
    super(repository, new PgAuthSessionMapper());
  }

  // One `update … where id and token_id`: of two refreshes spending the same token, Postgres lets
  // the second re-check the condition after the first commits, so exactly one matches.
  async rotateToken(
    id: string,
    currentTokenId: string,
    next: AuthSessionRotation,
  ): Promise<boolean> {
    try {
      const updated = await this.repository.nativeUpdate(
        { id, tokenId: currentTokenId },
        { ...next, updatedAt: new Date() },
      );

      return updated > 0;
    } catch (error) {
      throw this.toFailure('rotate', error);
    }
  }
}
