import { Module } from '@nestjs/common';
import { StorageRpcModule } from 'modules/storage/rpc/storage.rpc.module';

@Module({
  imports: [StorageRpcModule],
})
export class StorageModule {}
