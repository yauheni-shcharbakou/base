import { PostgresModule } from '@backend/persistence';
import { Module } from '@nestjs/common';
import { VideoEntity } from 'common/repositories/video/entities/video.entity';
import { VideoRepositoryImpl } from 'common/repositories/video/impl/video.repository.impl';
import { VIDEO_REPOSITORY } from 'common/repositories/video/video.repository';

@Module({
  imports: [PostgresModule.forFeature(VideoEntity)],
  providers: [
    {
      provide: VIDEO_REPOSITORY,
      useClass: VideoRepositoryImpl,
    },
  ],
  exports: [VIDEO_REPOSITORY],
})
export class VideoRepositoryModule {}
