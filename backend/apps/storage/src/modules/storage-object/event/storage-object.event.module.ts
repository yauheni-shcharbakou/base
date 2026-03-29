import { Module } from '@nestjs/common';
import { StorageObjectServiceModule } from 'common/services/storage-object/storage-object.service.module';
import { StorageObjectEventController } from 'modules/storage-object/event/storage-object.event.controller';

@Module({
  imports: [StorageObjectServiceModule],
  controllers: [StorageObjectEventController],
})
export class StorageObjectEventModule {}
