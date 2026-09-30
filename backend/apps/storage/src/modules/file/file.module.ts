import { RedisFileTransport, RedisModule } from '@backend/event-bus-redis';
import { PgModule } from '@backend/pg';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { StorageObjectModule } from '@modules/storage-object/storage-object.module';
import { StorageModule } from '@modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { FileMapper } from './application/mappers/file.mapper';
import { FileCompletionService } from './application/services/file.completion.service';
import { FileDropService } from './application/services/file.drop.service';
import { FilePurgeService } from './application/services/file.purge.service';
import { FileCleanupUseCase } from './application/use-cases/file.cleanup.use-case';
import { FileCompleteManyUseCase } from './application/use-cases/file.complete-many.use-case';
import { FileCompleteUploadUseCase } from './application/use-cases/file.complete-upload.use-case';
import { FileCreateManyUseCase } from './application/use-cases/file.create-many.use-case';
import { FileCreateOneUseCase } from './application/use-cases/file.create-one.use-case';
import { FileDeleteByOwnerUseCase } from './application/use-cases/file.delete-by-owner.use-case';
import { FileDeleteUseCase } from './application/use-cases/file.delete.use-case';
import { FileGetDownloadMapUseCase } from './application/use-cases/file.get-download-map.use-case';
import { FileGetUrlMapUseCase } from './application/use-cases/file.get-url-map.use-case';
import { FileGetUseCase } from './application/use-cases/file.get.use-case';
import { FileUpdateUseCase } from './application/use-cases/file.update.use-case';
import { FileRepository } from './domain/repositories/file.repository';
import { PgFileRepositoryImpl } from './infrastructure/pg/repositories/pg.file.repository.impl';
import { CronFileScheduler } from './interface/cron/cron.file.scheduler';
import { GrpcFileController } from './interface/grpc/grpc.file.controller';
import { RedisFileController } from './interface/redis/redis.file.controller';

@Module({
  imports: [
    PgModule.forFeature(PgFileEntity, PgStorageObjectEntity),
    RedisModule.forFeature({ EventBus: RedisFileTransport.EventBus }),
    StorageModule,
    StorageObjectModule,
  ],
  providers: [
    {
      provide: FileRepository,
      useClass: PgFileRepositoryImpl,
    },
    FileMapper,
    FilePurgeService,
    FileDropService,
    FileCompletionService,
    FileGetUrlMapUseCase,
    FileGetDownloadMapUseCase,
    FileGetUseCase,
    FileCreateOneUseCase,
    FileCreateManyUseCase,
    FileCompleteUploadUseCase,
    FileCompleteManyUseCase,
    FileDeleteUseCase,
    FileDeleteByOwnerUseCase,
    FileCleanupUseCase,
    FileUpdateUseCase,
    CronFileScheduler,
  ],
  controllers: [GrpcFileController, RedisFileController],
  exports: [FileMapper, FilePurgeService, FileRepository, FileDeleteByOwnerUseCase],
})
export class FileModule {}
