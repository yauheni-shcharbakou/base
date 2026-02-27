import { GrpcFileService, GrpcStorageObjectService } from '@backend/grpc';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { StorageServiceImpl } from 'modules/storage/service/impl/storage.service.impl';
import { STORAGE_SERVICE } from 'modules/storage/service/storage.service';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        storage: [GrpcFileService.name, GrpcStorageObjectService.name],
      },
    }),
  ],
  providers: [
    {
      provide: STORAGE_SERVICE,
      useClass: StorageServiceImpl,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageServiceModule {}
