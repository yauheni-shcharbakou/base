/* eslint-disable */
import type { NestCommon } from '@backend/proto';
import { type Observable } from 'rxjs';
import { ProviderIdEvent, StorageObjectUpdateParentEvent, VideoUpdateOneEvent } from './events';

export abstract class EventBus {}

export abstract class AuthUserEventBus extends EventBus {
  abstract onCreateOne(event: NestCommon.IdField): Observable<any>;
}

export abstract class StorageFileEventBus extends EventBus {
  abstract onDeleteOne(event: ProviderIdEvent): Observable<any>;
}

export abstract class StorageStorageObjectEventBus extends EventBus {
  abstract onUpdateParent(event: StorageObjectUpdateParentEvent): Observable<any>;
}

export abstract class StorageVideoEventBus extends EventBus {
  abstract onDeleteOne(event: ProviderIdEvent): Observable<any>;

  abstract onUpdateOne(event: VideoUpdateOneEvent): Observable<any>;
}

export enum EventBusHost {
  AUTH = 'auth',
  STORAGE = 'storage',
}
