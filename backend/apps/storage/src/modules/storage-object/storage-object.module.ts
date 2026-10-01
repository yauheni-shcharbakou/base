import { PgModule } from '@backend/pg';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { StorageModule } from '@modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { StorageObjectPlacementService } from './application/services/storage-object.placement.service';
import { StorageObjectValidationService } from './application/services/storage-object.validation.service';
import { StorageObjectCleanupUseCase } from './application/use-cases/storage-object.cleanup.use-case';
import { StorageObjectCreateFoldersUseCase } from './application/use-cases/storage-object.create-folders.use-case';
import { StorageObjectCreateOneUseCase } from './application/use-cases/storage-object.create-one.use-case';
import { StorageObjectCreateRootFolderUseCase } from './application/use-cases/storage-object.create-root-folder.use-case';
import { StorageObjectDeleteManyUseCase } from './application/use-cases/storage-object.delete-many.use-case';
import { StorageObjectDeleteOneUseCase } from './application/use-cases/storage-object.delete-one.use-case';
import { StorageObjectDeleteRootFolderUseCase } from './application/use-cases/storage-object.delete-root-folder.use-case';
import { StorageObjectGetFolderContentUseCase } from './application/use-cases/storage-object.get-folder-content.use-case';
import { StorageObjectGetFoldersUseCase } from './application/use-cases/storage-object.get-folders.use-case';
import { StorageObjectGetUseCase } from './application/use-cases/storage-object.get.use-case';
import { StorageObjectIsExistsUseCase } from './application/use-cases/storage-object.is-exists.use-case';
import { StorageObjectMoveManyUseCase } from './application/use-cases/storage-object.move-many.use-case';
import { StorageObjectUpdateOneUseCase } from './application/use-cases/storage-object.update-one.use-case';
import { StorageObjectUpdatePublicManyUseCase } from './application/use-cases/storage-object.update-public-many.use-case';
import { StorageObjectRepository } from './domain/repositories/storage-object.repository';
import { PgStorageObjectRepositoryImpl } from './infrastructure/pg/repositories/pg.storage-object.repository.impl';
import { CronStorageObjectScheduler } from './interface/cron/cron.storage-object.scheduler';
import { GrpcStorageObjectController } from './interface/grpc/grpc.storage-object.controller';
import { RedisStorageObjectController } from './interface/redis/redis.storage-object.controller';

@Module({
  // `storage` signs the folder listing's previews. Never `file`: it imports this module.
  imports: [PgModule.forFeature(PgStorageObjectEntity), StorageModule],
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
    StorageObjectGetFolderContentUseCase,
    StorageObjectDeleteOneUseCase,
    StorageObjectDeleteManyUseCase,
    StorageObjectUpdateOneUseCase,
    StorageObjectMoveManyUseCase,
    StorageObjectUpdatePublicManyUseCase,
    StorageObjectCreateRootFolderUseCase,
    StorageObjectDeleteRootFolderUseCase,
    StorageObjectCreateOneUseCase,
    StorageObjectCreateFoldersUseCase,
    StorageObjectCleanupUseCase,
    CronStorageObjectScheduler,
  ],
  controllers: [GrpcStorageObjectController, RedisStorageObjectController],
  exports: [
    StorageObjectValidationService,
    StorageObjectPlacementService,
    StorageObjectRepository,
    StorageObjectDeleteRootFolderUseCase,
  ],
})
export class StorageObjectModule {}
