import { GrpcModule } from '@backend/grpc';
import { PgMigrationModule } from '@backend/pg';
import { GrpcUserTransport } from '@backend/proto';
import { PgFileEntity } from '@modules/file/infrastructure/pg/entities/pg.file.entity';
import { PgStorageObjectEntity } from '@modules/storage-object/infrastructure/pg/entities/pg.storage-object.entity';
import { Module } from '@nestjs/common';
import { Database } from '@packages/common';
import { migrationTasks } from './tasks';

@Module({
  imports: [
    GrpcModule.forRoot({
      appClientStrategy: {
        auth: [GrpcUserTransport.service],
      },
    }),
    PgMigrationModule.register({
      database: Database.STORAGE,
      tasks: migrationTasks,
      entities: [PgFileEntity, PgStorageObjectEntity],
    }),
  ],
})
export class MigratorModule {}
