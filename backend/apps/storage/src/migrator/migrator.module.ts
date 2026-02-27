import { GrpcUserService } from '@backend/grpc';
import { PostgresMigrationModule } from '@backend/persistence';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { Database } from '@packages/common';
import { FileEntity } from 'common/repositories/file/entities/file.entity';
import { ImageEntity } from 'common/repositories/image/entities/image.entity';
import { StorageObjectEntity } from 'common/repositories/storage-object/entities/storage-object.entity';
import { VideoEntity } from 'common/repositories/video/entities/video.entity';
import { migrationTasks } from 'migrator/tasks';

@Module({
  imports: [
    GrpcModule.forRoot({
      appClientStrategy: {
        auth: [GrpcUserService.name],
      },
    }),
    PostgresMigrationModule.register({
      database: Database.STORAGE,
      tasks: migrationTasks,
      entities: [FileEntity, StorageObjectEntity, ImageEntity, VideoEntity],
    }),
  ],
})
export class MigratorModule {}
