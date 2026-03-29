import { Module } from '@nestjs/common';
import { StorageObjectServiceModule } from 'common/services/storage-object/storage-object.service.module';
import { StorageObjectRpcController } from 'modules/storage-object/rpc/storage-object.rpc.controller';

@Module({
  imports: [StorageObjectServiceModule],
  controllers: [StorageObjectRpcController],
})
export class StorageObjectRpcModule {}
