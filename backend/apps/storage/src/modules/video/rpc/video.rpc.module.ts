import { Module } from '@nestjs/common';
import { VideoRpcController } from 'modules/video/rpc/video.rpc.controller';
import { VideoServiceModule } from 'modules/video/service/video.service.module';

@Module({
  imports: [VideoServiceModule],
  controllers: [VideoRpcController],
})
export class VideoRpcModule {}
