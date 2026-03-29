import { Module } from '@nestjs/common';
import { FileRepositoryModule } from 'common/repositories/file/file.repository.module';
import { ImageRepositoryModule } from 'common/repositories/image/image.repository.module';
import { FileStorageServiceModule } from 'common/services/file-storage/file-storage.service.module';
import { StorageObjectServiceModule } from 'common/services/storage-object/storage-object.service.module';
import { IMAGE_SERVICE } from 'modules/image/service/image.service';
import { ImageServiceImpl } from 'modules/image/service/impl/image.service.impl';

@Module({
  imports: [
    FileRepositoryModule,
    FileStorageServiceModule,
    ImageRepositoryModule,
    StorageObjectServiceModule,
  ],
  providers: [
    {
      provide: IMAGE_SERVICE,
      useClass: ImageServiceImpl,
    },
  ],
  exports: [IMAGE_SERVICE],
})
export class ImageServiceModule {}
