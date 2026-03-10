import { Module } from '@nestjs/common';
import { VideoRpcModule } from 'modules/video/rpc/video.rpc.module';

@Module({
  imports: [VideoRpcModule],
})
export class VideoModule {}
