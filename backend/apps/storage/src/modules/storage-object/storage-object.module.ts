import { Module } from '@nestjs/common';
import { StorageObjectRpcModule } from 'modules/storage-object/rpc/storage-object.rpc.module';

@Module({
  imports: [StorageObjectRpcModule],
})
export class StorageObjectModule {}
