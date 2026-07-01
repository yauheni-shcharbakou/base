/* eslint-disable */
import { StorageObjectParentUpdateEvent } from '@/strategy/events';
import type { NestAuth, NestStorage } from '@backend/proto';

export abstract class EventBus {}

export abstract class UserEventBus extends EventBus {
  abstract emitCreate(event: NestAuth.User): Promise<any>;

  abstract emitManyCreate(events: NestAuth.User[]): Promise<any[]>;
}

export abstract class ImageEventBus extends EventBus {
  abstract emitDelete(event: NestStorage.Image): Promise<any>;

  abstract emitManyDelete(events: NestStorage.Image[]): Promise<any[]>;
}

export abstract class StorageObjectEventBus extends EventBus {
  abstract emitParentUpdate(event: StorageObjectParentUpdateEvent): Promise<any>;

  abstract emitManyParentUpdate(events: StorageObjectParentUpdateEvent[]): Promise<any[]>;
}

export abstract class VideoEventBus extends EventBus {
  abstract emitUploadFinish(event: NestStorage.Video): Promise<any>;

  abstract emitManyUploadFinish(events: NestStorage.Video[]): Promise<any[]>;

  abstract emitUploadFail(event: NestStorage.Video): Promise<any>;

  abstract emitManyUploadFail(events: NestStorage.Video[]): Promise<any[]>;
}

export enum EventBusHost {
  AUTH = 'auth',
  STORAGE = 'storage',
}
