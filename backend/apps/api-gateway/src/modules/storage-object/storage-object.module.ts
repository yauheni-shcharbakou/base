import { GrpcModule } from '@backend/grpc';
import { GrpcStorageObjectTransport } from '@backend/proto';
import { Module } from '@nestjs/common';
import { StorageObjectMapper } from './application/mappers/storage-object.mapper';
import { StorageObjectProxyService } from './application/services/storage-object.proxy.service';
import { GrpcStorageObjectAdminController } from './interface/grpc/grpc.storage-object.admin.controller';
import { GrpcStorageObjectWebController } from './interface/grpc/grpc.storage-object.web.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        storage: [GrpcStorageObjectTransport.service],
      },
    }),
  ],
  providers: [StorageObjectMapper, StorageObjectProxyService],
  controllers: [GrpcStorageObjectWebController, GrpcStorageObjectAdminController],
})
export class StorageObjectModule {}
