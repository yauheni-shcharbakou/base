import {
  NatsJsStorageObjectEventController,
  NatsJsStorageObjectService,
  StorageObjectUpdateIsPublicEvent,
} from '@backend/transport';
import { Inject } from '@nestjs/common';
import {
  STORAGE_OBJECT_SERVICE,
  StorageObjectService,
} from 'modules/storage-object/service/storage-object.service';

@NatsJsStorageObjectService.Controller()
export class StorageObjectEventController implements NatsJsStorageObjectEventController {
  constructor(
    @Inject(STORAGE_OBJECT_SERVICE) private readonly storageObjectService: StorageObjectService,
  ) {}

  async updateIsPublic(event: StorageObjectUpdateIsPublicEvent): Promise<void> {
    await this.storageObjectService.onUpdateIsPublic(event);
  }
}
