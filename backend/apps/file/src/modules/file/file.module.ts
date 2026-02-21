import { Module } from '@nestjs/common';
import { FileRpcModule } from 'modules/file/rpc/file.rpc.module';

@Module({
  imports: [FileRpcModule],
})
export class FileModule {}
