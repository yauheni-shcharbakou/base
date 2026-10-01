import { NestAuth } from '@backend/proto';
import {
  RedisController,
  RedisEvent,
  RedisUserCreateEventHandler,
  RedisUserDeleteEventHandler,
  RedisUserTransport,
} from '@backend/event-bus-redis';
import { StorageObjectCreateRootFolderUseCase } from '@modules/storage-object/application/use-cases/storage-object.create-root-folder.use-case';
import { StorageObjectDeleteRootFolderUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-root-folder.use-case';

@RedisController({ consumer: 'storage.storage-object' })
export class RedisStorageObjectController
  implements RedisUserCreateEventHandler, RedisUserDeleteEventHandler
{
  constructor(
    private readonly createRootFolderUseCase: StorageObjectCreateRootFolderUseCase,
    private readonly deleteRootFolderUseCase: StorageObjectDeleteRootFolderUseCase,
  ) {}

  @RedisEvent(RedisUserTransport.CREATE)
  async onUserCreate(event: NestAuth.User): Promise<void> {
    const result = await this.createRootFolderUseCase.execute(event.id);

    // Throwing marks the job failed, so BullMQ retries it. Swallowing the error here would ack a
    // write that never happened and the user would stay without a root folder for good.
    if (result.isLeft()) {
      throw result.value;
    }
  }

  @RedisEvent(RedisUserTransport.DELETE)
  async onUserDelete(event: NestAuth.User): Promise<void> {
    const result = await this.deleteRootFolderUseCase.execute(event.id);

    // Retried like the create: an unmarked tree of a deleted user is never reached again.
    if (result.isLeft()) {
      throw result.value;
    }
  }
}
