import { Module } from '@nestjs/common';
import { StorageObjectRepositoryModule } from 'common/repositories/storage-object/storage-object.repository.module';
import { StorageObjectServiceImpl } from 'modules/storage-object/service/impl/storage-object.service.impl';
import { STORAGE_OBJECT_SERVICE } from 'modules/storage-object/service/storage-object.service';

@Module({
  imports: [StorageObjectRepositoryModule],
  providers: [
    {
      provide: STORAGE_OBJECT_SERVICE,
      useClass: StorageObjectServiceImpl,
    },
  ],
  exports: [STORAGE_OBJECT_SERVICE],
})
export class StorageObjectServiceModule {}
