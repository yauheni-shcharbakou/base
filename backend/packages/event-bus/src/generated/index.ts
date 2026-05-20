/* eslint-disable */
import { StorageObjectUpdateParentEvent, VideoUpdateOneEvent } from '@/strategy/events';
import type { NestAuth, NestStorage } from '@backend/proto';

export abstract class EventBus {}

export abstract class AuthUserEventBus extends EventBus {
  abstract emitCreate(event: NestAuth.User): Promise<any>;

  abstract emitManyCreate(events: NestAuth.User[]): Promise<any[]>;
}

export abstract class StorageFileEventBus extends EventBus {
  abstract emitDelete(event: NestStorage.File): Promise<any>;

  abstract emitManyDelete(events: NestStorage.File[]): Promise<any[]>;
}

export abstract class StorageStorageObjectEventBus extends EventBus {
  abstract emitUpdateParent(event: StorageObjectUpdateParentEvent): Promise<any>;

  abstract emitManyUpdateParent(events: StorageObjectUpdateParentEvent[]): Promise<any[]>;
}

export abstract class StorageVideoEventBus extends EventBus {
  abstract emitDelete(event: NestStorage.Video): Promise<any>;

  abstract emitManyDelete(events: NestStorage.Video[]): Promise<any[]>;

  abstract emitUpdate(event: VideoUpdateOneEvent): Promise<any>;

  abstract emitManyUpdate(events: VideoUpdateOneEvent[]): Promise<any[]>;
}

export enum EventBusHost {
  AUTH = 'auth',
  STORAGE = 'storage',
}
