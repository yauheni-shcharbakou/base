import { Module } from '@nestjs/common';
import { FileRepositoryModule } from 'common/repositories/file/file.repository.module';
import { ImageRepositoryModule } from 'common/repositories/image/image.repository.module';
import { StorageObjectRepositoryModule } from 'common/repositories/storage-object/storage-object.repository.module';
import { IMAGE_SERVICE } from 'modules/image/service/image.service';
import { ImageServiceImpl } from 'modules/image/service/impl/image.service.impl';

@Module({
  imports: [FileRepositoryModule, ImageRepositoryModule, StorageObjectRepositoryModule],
  providers: [
    {
      provide: IMAGE_SERVICE,
      useClass: ImageServiceImpl,
    },
  ],
  exports: [IMAGE_SERVICE],
})
export class ImageServiceModule {}
