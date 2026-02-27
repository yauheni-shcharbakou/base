import { Module } from '@nestjs/common';
import { StorageObjectRpcController } from 'modules/storage-object/rpc/storage-object.rpc.controller';
import { StorageObjectServiceModule } from 'modules/storage-object/service/storage-object.service.module';

@Module({
  imports: [StorageObjectServiceModule],
  controllers: [StorageObjectRpcController],
})
export class StorageObjectRpcModule {}
