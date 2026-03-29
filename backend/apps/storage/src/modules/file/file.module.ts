import { Module } from '@nestjs/common';
import { FileEventModule } from 'modules/file/event/file.event.module';
import { FileRpcModule } from 'modules/file/rpc/file.rpc.module';

@Module({
  imports: [FileRpcModule, FileEventModule],
})
export class FileModule {}
