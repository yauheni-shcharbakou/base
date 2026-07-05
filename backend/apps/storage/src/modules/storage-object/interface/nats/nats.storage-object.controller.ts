import { StorageObjectParentUpdateEvent } from '@backend/event-bus';
import {
  NatsController,
  NatsEvent,
  NatsStorageObjectEventController,
  NatsStorageObjectTransport,
  NatsUserCreateEventHandler,
  NatsUserTransport,
} from '@backend/nats';
import { NestAuth } from '@backend/proto';
import { StorageObjectCreateRootFolderUseCase } from '@modules/storage-object/application/use-cases/storage-object.create-root-folder.use-case';
import { StorageObjectUpdateFolderChildrenUseCase } from '@modules/storage-object/application/use-cases/storage-object.update-folder-children.use-case';

@NatsController()
@NatsStorageObjectTransport.ControllerMethods()
export class NatsStorageObjectController
  implements NatsStorageObjectEventController, NatsUserCreateEventHandler
{
  constructor(
    private readonly createRootFolderUseCase: StorageObjectCreateRootFolderUseCase,
    private readonly updateFolderChildrenUseCase: StorageObjectUpdateFolderChildrenUseCase,
  ) {}

  async onParentUpdate(event: StorageObjectParentUpdateEvent): Promise<void> {
    await this.updateFolderChildrenUseCase.execute(event.parent, event.update);
  }

  @NatsEvent(NatsUserTransport.CREATE)
  async onUserCreate(event: NestAuth.User): Promise<void> {
    await this.createRootFolderUseCase.execute(event.id);
  }
}
