import { GrpcModule } from '@backend/grpc';
import { PgMigrationModule } from '@backend/pg';
import { GrpcUserTransport } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
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
      entities: [PgFileEntity, PgStorageObjectEntity, PgImageEntity, PgVideoEntity],
    }),
  ],
})
export class MigratorModule {}
