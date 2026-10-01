import { PgModule } from '@backend/pg';
import { Module } from '@nestjs/common';
import { AuthSessionRepository } from './domain/repositories/auth.session.repository';
import { PgAuthSessionEntity } from './infrastructure/pg/entities/pg.auth-session.entity';
import { PgAuthSessionRepositoryImpl } from './infrastructure/pg/repositories/pg.auth-session.repository.impl';

/**
 * The sessions' repository, apart from `AuthModule`: `UserModule` ends a user's sessions on a
 * password change, and `AuthModule` imports `UserModule`, so neither could take it from the other.
 */
@Module({
  imports: [PgModule.forFeature(PgAuthSessionEntity)],
  providers: [
    {
      provide: AuthSessionRepository,
      useClass: PgAuthSessionRepositoryImpl,
    },
  ],
  exports: [AuthSessionRepository],
})
export class AuthSessionModule {}
