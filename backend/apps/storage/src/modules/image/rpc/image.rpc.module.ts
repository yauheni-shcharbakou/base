import { Module } from '@nestjs/common';
import { ImageRpcController } from 'modules/image/rpc/image.rpc.controller';
import { ImageServiceModule } from 'modules/image/service/image.service.module';

@Module({
  imports: [ImageServiceModule],
  controllers: [ImageRpcController],
})
export class ImageRpcModule {}
