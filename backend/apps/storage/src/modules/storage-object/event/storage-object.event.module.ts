import { Module } from '@nestjs/common';
import { StorageObjectEventController } from 'modules/storage-object/event/storage-object.event.controller';
import { StorageObjectServiceModule } from 'modules/storage-object/service/storage-object.service.module';

@Module({
  imports: [StorageObjectServiceModule],
  controllers: [StorageObjectEventController],
})
export class StorageObjectEventModule {}
