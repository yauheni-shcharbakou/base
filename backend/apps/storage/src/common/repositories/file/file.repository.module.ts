import { PostgresModule } from '@backend/persistence';
import { Module } from '@nestjs/common';
import { FileEntity } from 'common/repositories/file/entities/file.entity';
import { FILE_REPOSITORY } from 'common/repositories/file/file.repository';
import { FileRepositoryImpl } from 'common/repositories/file/impl/file.repository.impl';
import { VideoEntity } from 'common/repositories/video/entities/video.entity';

@Module({
  imports: [PostgresModule.forFeature(FileEntity, VideoEntity)],
  providers: [
    {
      provide: FILE_REPOSITORY,
      useClass: FileRepositoryImpl,
    },
  ],
  exports: [FILE_REPOSITORY],
})
export class FileRepositoryModule {}
