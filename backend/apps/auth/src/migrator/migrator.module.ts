import { PgMigrationModule } from '@backend/pg';
import { CryptoModule } from '@modules/crypto/crypto.module';
import { PgTempCodeEntity } from '@modules/temp-code/infrastructure/pg/entities/pg.temp-code.entity';
import { PgUserEntity } from '@modules/user/infrastructure/pg/entities/pg.user.entity';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Database } from '@packages/common';
import { config } from '../config';
import { migrationTasks } from './tasks';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    PgMigrationModule.register({
      database: Database.AUTH,
      imports: [ConfigModule, CryptoModule],
      tasks: migrationTasks,
      entities: [PgUserEntity, PgTempCodeEntity],
    }),
  ],
})
export class MigratorModule {}
