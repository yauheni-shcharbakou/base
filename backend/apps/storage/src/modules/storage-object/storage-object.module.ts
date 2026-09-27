import { PgModule } from '@backend/pg';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { Module } from '@nestjs/common';
import { StorageObjectPlacementService } from './application/services/storage-object.placement.service';
import { StorageObjectValidationService } from './application/services/storage-object.validation.service';
import { StorageObjectCleanupUseCase } from './application/use-cases/storage-object.cleanup.use-case';
import { StorageObjectCreateOneUseCase } from './application/use-cases/storage-object.create-one.use-case';
import { StorageObjectCreateRootFolderUseCase } from './application/use-cases/storage-object.create-root-folder.use-case';
import { StorageObjectDeleteOneUseCase } from './application/use-cases/storage-object.delete-one.use-case';
import { StorageObjectGetFoldersUseCase } from './application/use-cases/storage-object.get-folders.use-case';
import { StorageObjectGetUseCase } from './application/use-cases/storage-object.get.use-case';
import { StorageObjectIsExistsUseCase } from './application/use-cases/storage-object.is-exists.use-case';
import { StorageObjectUpdateOneUseCase } from './application/use-cases/storage-object.update-one.use-case';
import { StorageObjectRepository } from './domain/repositories/storage-object.repository';
import { PgStorageObjectRepositoryImpl } from './infrastructure/pg/repositories/pg.storage-object.repository.impl';
import { CronStorageObjectScheduler } from './interface/cron/cron.storage-object.scheduler';
import { GrpcStorageObjectController } from './interface/grpc/grpc.storage-object.controller';
import { RedisStorageObjectController } from './interface/redis/redis.storage-object.controller';

@Module({
  imports: [PgModule.forFeature(PgStorageObjectEntity)],
  providers: [
    {
      provide: StorageObjectRepository,
      useClass: PgStorageObjectRepositoryImpl,
    },
    StorageObjectValidationService,
    StorageObjectPlacementService,
    StorageObjectIsExistsUseCase,
    StorageObjectGetUseCase,
    StorageObjectGetFoldersUseCase,
    StorageObjectDeleteOneUseCase,
    StorageObjectUpdateOneUseCase,
    StorageObjectCreateRootFolderUseCase,
    StorageObjectCreateOneUseCase,
    StorageObjectCleanupUseCase,
    CronStorageObjectScheduler,
  ],
  controllers: [GrpcStorageObjectController, RedisStorageObjectController],
  exports: [StorageObjectValidationService, StorageObjectPlacementService],
})
export class StorageObjectModule {}
