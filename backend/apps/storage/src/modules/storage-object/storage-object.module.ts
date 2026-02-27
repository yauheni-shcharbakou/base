import { Module } from '@nestjs/common';
import { StorageObjectEventModule } from 'modules/storage-object/event/storage-object.event.module';
import { StorageObjectRpcModule } from 'modules/storage-object/rpc/storage-object.rpc.module';

@Module({
  imports: [StorageObjectEventModule, StorageObjectRpcModule],
})
export class StorageObjectModule {}
