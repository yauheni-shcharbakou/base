import { PgRepositoryImpl } from '@backend/pg';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { AuthSession } from '@modules/auth/domain/interfaces/auth.interface';
import {
  AuthSessionCreate,
  AuthSessionQuery,
  AuthSessionRepository,
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
}
