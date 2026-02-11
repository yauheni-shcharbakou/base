import { Module } from '@nestjs/common';
import { FileRepositoryModule } from 'common/repositories/file/file.repository.module';
import { FileServiceImpl } from 'modules/file/service/impl/file.service.impl';
import { FILE_SERVICE } from 'modules/file/service/file.service';

@Module({
  imports: [FileRepositoryModule],
  providers: [
    {
      provide: FILE_SERVICE,
      useClass: FileServiceImpl,
    },
  ],
  exports: [FILE_SERVICE],
})
export class FileServiceModule {}
