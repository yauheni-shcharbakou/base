import { NatsModule, NatsStorageObjectTransport } from '@backend/nats';
import { PgModule } from '@backend/pg';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { StorageModule } from '@modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { StorageObjectValidationService } from './application/services/storage-object.validation.service';
import { StorageObjectCreateOneUseCase } from './application/use-cases/storage-object.create-one.use-case';
import { StorageObjectCreateRootFolderUseCase } from './application/use-cases/storage-object.create-root-folder.use-case';
import { StorageObjectDeleteOneUseCase } from './application/use-cases/storage-object.delete-one.use-case';
import { StorageObjectGetFoldersUseCase } from './application/use-cases/storage-object.get-folders.use-case';
import { StorageObjectGetUseCase } from './application/use-cases/storage-object.get.use-case';
import { StorageObjectIsExistsUseCase } from './application/use-cases/storage-object.is-exists.use-case';
import { StorageObjectUpdateFolderChildrenUseCase } from './application/use-cases/storage-object.update-folder-children.use-case';
import { StorageObjectUpdateOneUseCase } from './application/use-cases/storage-object.update-one.use-case';
import { StorageObjectRepository } from './domain/repositories/storage-object.repository';
import { PgStorageObjectRepositoryImpl } from './infrastructure/pg/repositories/pg.storage-object.repository.impl';
import { GrpcStorageObjectController } from './interface/grpc/grpc.storage-object.controller';
import { NatsStorageObjectController } from './interface/nats/nats.storage-object.controller';

@Module({
  imports: [
    PgModule.forFeature(PgStorageObjectEntity),
    NatsModule.forFeature({ EventBus: NatsStorageObjectTransport.EventBus }),
    StorageModule,
  ],
  providers: [
    {
      provide: StorageObjectRepository,
      useClass: PgStorageObjectRepositoryImpl,
    },
    StorageObjectValidationService,
    StorageObjectIsExistsUseCase,
    StorageObjectGetUseCase,
    StorageObjectGetFoldersUseCase,
    StorageObjectDeleteOneUseCase,
    StorageObjectUpdateOneUseCase,
    StorageObjectCreateRootFolderUseCase,
    StorageObjectUpdateFolderChildrenUseCase,
    StorageObjectCreateOneUseCase,
  ],
  controllers: [GrpcStorageObjectController, NatsStorageObjectController],
  exports: [StorageObjectValidationService],
})
export class StorageObjectModule {}
