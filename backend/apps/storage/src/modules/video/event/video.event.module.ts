import { Module } from '@nestjs/common';
import { VideoEventController } from 'modules/video/event/video.event.controller';
import { VideoServiceModule } from 'modules/video/service/video.service.module';

@Module({
  imports: [VideoServiceModule],
  controllers: [VideoEventController],
})
export class VideoEventModule {}
