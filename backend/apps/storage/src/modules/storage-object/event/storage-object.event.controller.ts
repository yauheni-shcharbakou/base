import { GrpcIdField } from '@backend/grpc';
import {
  NatsEvent,
  NatsStorageObjectEventController,
  NatsStorageObjectTransport,
  NatsUserCreateOneEventHandler,
  NatsUserTransport,
  StorageObjectUpdateParentEvent,
} from '@backend/transport';
import { Inject } from '@nestjs/common';
import {
  STORAGE_OBJECT_SERVICE,
  StorageObjectService,
} from 'common/services/storage-object/storage-object.service';
import { from, Observable } from 'rxjs';

@NatsStorageObjectTransport.Controller()
export class StorageObjectEventController
  implements NatsStorageObjectEventController, NatsUserCreateOneEventHandler
{
  constructor(
    @Inject(STORAGE_OBJECT_SERVICE) private readonly storageObjectService: StorageObjectService,
  ) {}

  onUpdateParent(event: StorageObjectUpdateParentEvent): Observable<void> {
    return from(this.storageObjectService.onUpdateParent(event));
  }

  @NatsEvent(NatsUserTransport.CREATE_ONE)
  onUserCreateOne(event: GrpcIdField): Observable<void> {
    return from(this.storageObjectService.createRootFolder(event.id));
  }
}
