import { Module } from '@nestjs/common';
import { FileRpcController } from 'modules/file/rpc/file.rpc.controller';
import { FileServiceModule } from 'modules/file/service/file.service.module';

@Module({
  imports: [FileServiceModule],
  controllers: [FileRpcController],
})
export class FileRpcModule {}
