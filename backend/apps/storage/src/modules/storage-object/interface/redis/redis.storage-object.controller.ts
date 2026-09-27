import { NestAuth } from '@backend/proto';
import {
  RedisController,
  RedisEvent,
  RedisUserCreateEventHandler,
  RedisUserTransport,
} from '@backend/event-bus-redis';
import { StorageObjectCreateRootFolderUseCase } from '@modules/storage-object/application/use-cases/storage-object.create-root-folder.use-case';

@RedisController({ consumer: 'storage.storage-object' })
export class RedisStorageObjectController implements RedisUserCreateEventHandler {
  constructor(private readonly createRootFolderUseCase: StorageObjectCreateRootFolderUseCase) {}

  @RedisEvent(RedisUserTransport.CREATE)
  async onUserCreate(event: NestAuth.User): Promise<void> {
    const result = await this.createRootFolderUseCase.execute(event.id);

    // Throwing marks the job failed, so BullMQ retries it. Swallowing the error here would ack a
    // write that never happened and the user would stay without a root folder for good.
    if (result.isLeft()) {
      throw result.value;
    }
  }
}
