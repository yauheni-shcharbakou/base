import { MongoModule } from '@backend/persistence';
import { Module } from '@nestjs/common';
import { FileEntity } from 'common/repositories/file/entities/file.entity';
import { FILE_REPOSITORY } from 'common/repositories/file/file.repository';
import { FileRepositoryImpl } from 'common/repositories/file/impl/file.repository.impl';

@Module({
  imports: [MongoModule.forFeature(FileEntity)],
  providers: [
    {
      provide: FILE_REPOSITORY,
      useClass: FileRepositoryImpl,
    },
  ],
  exports: [FILE_REPOSITORY],
})
export class FileRepositoryModule {}
