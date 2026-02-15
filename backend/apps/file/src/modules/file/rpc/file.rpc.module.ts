import { Module } from '@nestjs/common';
import { FileRepositoryModule } from 'common/repositories/file/file.repository.module';
import { FileRpcController } from 'modules/file/rpc/file.rpc.controller';
import { FileServiceModule } from 'modules/file/service/file.service.module';

@Module({
  imports: [FileRepositoryModule, FileServiceModule],
  controllers: [FileRpcController],
})
export class FileRpcModule {}
