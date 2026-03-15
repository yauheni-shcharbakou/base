import {
  NatsJsVideoEventController,
  NatsJsVideoService,
  ProviderIdEvent,
  VideoUpdateOneEvent,
} from '@backend/transport';
import { Inject } from '@nestjs/common';
import { VIDEO_SERVICE, VideoService } from 'modules/video/service/video.service';

@NatsJsVideoService.Controller()
export class VideoEventController implements NatsJsVideoEventController {
  constructor(@Inject(VIDEO_SERVICE) private readonly videoService: VideoService) {}

  async deleteOne(event: ProviderIdEvent): Promise<void> {
    await this.videoService.onVideoDelete(event);
  }

  async updateOne(event: VideoUpdateOneEvent): Promise<void> {
    await this.videoService.onVideoUpdate(event);
  }
}
