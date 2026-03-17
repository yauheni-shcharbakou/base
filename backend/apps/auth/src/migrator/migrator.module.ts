import { PostgresMigrationModule } from '@backend/persistence';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Database } from '@packages/common';
import { UserEntity } from 'common/repositories/user/entities/user.entity';
import { CryptoServiceModule } from 'common/services/crypto/crypto.service.module';
import { config } from 'config';
import { migrationTasks } from 'migrator/tasks';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    PostgresMigrationModule.register({
      database: Database.AUTH,
      imports: [ConfigModule, CryptoServiceModule],
      tasks: migrationTasks,
      entities: [UserEntity],
    }),
  ],
})
export class MigratorModule {}
