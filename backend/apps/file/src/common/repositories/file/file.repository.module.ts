import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileEntity, FileSchema } from 'common/entities/file.entity';
import { FILE_REPOSITORY } from 'common/repositories/file/file.repository';
import { FileRepositoryImpl } from 'common/repositories/file/impl/file.repository.impl';

@Module({
  imports: [MongooseModule.forFeature([{ name: FileEntity.name, schema: FileSchema }])],
  providers: [
    {
      provide: FILE_REPOSITORY,
      useClass: FileRepositoryImpl,
    },
  ],
  exports: [FILE_REPOSITORY],
})
export class FileRepositoryModule {}
