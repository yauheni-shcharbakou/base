import { Controller, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  VideoDeleteOneEvent,
  VideoEventPattern,
  VideoUpdateOneEvent,
} from 'common/events/video.events';
import { VIDEO_SERVICE, VideoService } from 'modules/video/service/video.service';

@Controller()
export class VideoEventController {
  constructor(@Inject(VIDEO_SERVICE) private readonly videoService: VideoService) {}

  @OnEvent(VideoEventPattern.DELETE_ONE)
  async onVideoDelete(payload: VideoDeleteOneEvent) {
    await this.videoService.onVideoDelete(payload);
  }

  @OnEvent(VideoEventPattern.UPDATE_ONE)
  async onVideoUpdate(payload: VideoUpdateOneEvent) {
    await this.videoService.onVideoUpdate(payload);
  }
}
