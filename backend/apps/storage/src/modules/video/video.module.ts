import { Module } from '@nestjs/common';
import { VideoEventModule } from 'modules/video/event/video.event.module';
import { VideoRpcModule } from 'modules/video/rpc/video.rpc.module';

@Module({
  imports: [VideoRpcModule, VideoEventModule],
})
export class VideoModule {}
