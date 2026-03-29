import { Module } from '@nestjs/common';
import { FileRepositoryModule } from 'common/repositories/file/file.repository.module';
import { FileStorageServiceModule } from 'common/services/file-storage/file-storage.service.module';
import { StorageObjectServiceModule } from 'common/services/storage-object/storage-object.service.module';
import { FileServiceImpl } from 'modules/file/service/impl/file.service.impl';
import { FILE_SERVICE } from 'modules/file/service/file.service';

@Module({
  imports: [FileRepositoryModule, FileStorageServiceModule, StorageObjectServiceModule],
  providers: [
    {
      provide: FILE_SERVICE,
      useClass: FileServiceImpl,
    },
  ],
  exports: [FILE_SERVICE],
})
export class FileServiceModule {}
