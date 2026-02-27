import { PostgresModule } from '@backend/persistence';
import { Module } from '@nestjs/common';
import { StorageObjectEntity } from 'common/repositories/storage-object/entities/storage-object.entity';
import { StorageObjectRepositoryImpl } from 'common/repositories/storage-object/impl/storage-object.repository.impl';
import { STORAGE_OBJECT_REPOSITORY } from 'common/repositories/storage-object/storage-object.repository';

@Module({
  imports: [PostgresModule.forFeature(StorageObjectEntity)],
  providers: [
    {
      provide: STORAGE_OBJECT_REPOSITORY,
      useClass: StorageObjectRepositoryImpl,
    },
  ],
  exports: [STORAGE_OBJECT_REPOSITORY],
})
export class StorageObjectRepositoryModule {}
