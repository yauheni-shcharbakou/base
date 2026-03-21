import { Module } from '@nestjs/common';
import { FileRepositoryModule } from 'common/repositories/file/file.repository.module';
import { VideoRepositoryModule } from 'common/repositories/video/video.repository.module';
import { VideoStorageServiceModule } from 'common/services/video-storage/video-storage.service.module';
import { VideoServiceImpl } from 'modules/video/service/impl/video.service.impl';
import { VIDEO_SERVICE } from 'modules/video/service/video.service';

@Module({
  imports: [FileRepositoryModule, VideoRepositoryModule, VideoStorageServiceModule],
  providers: [
    {
      provide: VIDEO_SERVICE,
      useClass: VideoServiceImpl,
    },
  ],
  exports: [VIDEO_SERVICE],
})
export class VideoServiceModule {}
