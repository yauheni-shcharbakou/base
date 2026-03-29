import {
  NatsVideoEventController,
  NatsVideoTransport,
  ProviderIdEvent,
  VideoUpdateOneEvent,
} from '@backend/transport';
import { Inject } from '@nestjs/common';
import { VIDEO_SERVICE, VideoService } from 'modules/video/service/video.service';
import { from, Observable } from 'rxjs';

@NatsVideoTransport.Controller()
export class VideoEventController implements NatsVideoEventController {
  constructor(@Inject(VIDEO_SERVICE) private readonly videoService: VideoService) {}

  onDeleteOne(event: ProviderIdEvent): Observable<void> {
    return from(this.videoService.onDeleteOne(event));
  }

  onUpdateOne(event: VideoUpdateOneEvent): Observable<void> {
    return from(this.videoService.onUpdateOne(event));
  }
}
