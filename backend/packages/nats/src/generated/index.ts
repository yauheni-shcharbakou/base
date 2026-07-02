/* eslint-disable */
import { globalStreamRegistry } from '@/infrastructure/utils';
import {
  EventBus,
  ImageEventBus,
  StorageObjectEventBus,
  StorageObjectParentUpdateEvent,
  UserEventBus,
  VideoEventBus,
} from '@backend/event-bus';
import type { NestAuth, NestStorage } from '@backend/proto';
import {
  NatsJetStreamClientProxy,
  NatsJetStreamContext,
} from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { Abstract, applyDecorators, Type } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { concat, firstValueFrom, lastValueFrom, Observable, toArray } from 'rxjs';

const NatsUserEventPattern = {
  CREATE: {
    pattern: 'auth-user-create',
    registerStream: (): void => {
      globalStreamRegistry.append({ name: 'auth-user-stream', subjects: ['auth-user-create'] });
    },
  },
};

export const NatsUserTransport = {
  ...NatsUserEventPattern,
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('auth-user-create')(
        constructor.prototype['onCreate'],
        'onCreate',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onCreate'),
      );
      NatsUserEventPattern.CREATE.registerStream();
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: UserEventBus,
} as const;

export interface NatsUserEventController {
  onCreate(
    event: NestAuth.User,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsUserCreateEventHandler {
  onUserCreate(
    event: NestAuth.User,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsImageEventPattern = {
  DELETE: {
    pattern: 'storage-image-delete',
    registerStream: (): void => {
      globalStreamRegistry.append({
        name: 'storage-image-stream',
        subjects: ['storage-image-delete'],
      });
    },
  },
};

export const NatsImageTransport = {
  ...NatsImageEventPattern,
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-image-delete')(
        constructor.prototype['onDelete'],
        'onDelete',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onDelete'),
      );
      NatsImageEventPattern.DELETE.registerStream();
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: ImageEventBus,
} as const;

export interface NatsImageEventController {
  onDelete(
    event: NestStorage.Image,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsImageDeleteEventHandler {
  onImageDelete(
    event: NestStorage.Image,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsStorageObjectEventPattern = {
  PARENT_UPDATE: {
    pattern: 'storage-storage-object-parent-update',
    registerStream: (): void => {
      globalStreamRegistry.append({
        name: 'storage-storage-object-stream',
        subjects: ['storage-storage-object-parent-update'],
      });
    },
  },
};

export const NatsStorageObjectTransport = {
  ...NatsStorageObjectEventPattern,
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-storage-object-parent-update')(
        constructor.prototype['onParentUpdate'],
        'onParentUpdate',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onParentUpdate'),
      );
      NatsStorageObjectEventPattern.PARENT_UPDATE.registerStream();
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: StorageObjectEventBus,
} as const;

export interface NatsStorageObjectEventController {
  onParentUpdate(
    event: StorageObjectParentUpdateEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsStorageObjectParentUpdateEventHandler {
  onStorageObjectParentUpdate(
    event: StorageObjectParentUpdateEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsVideoEventPattern = {
  UPLOAD_FINISH: {
    pattern: 'storage-video-upload-finish',
    registerStream: (): void => {
      globalStreamRegistry.append({
        name: 'storage-video-stream',
        subjects: ['storage-video-upload-finish'],
      });
    },
  },
  UPLOAD_FAIL: {
    pattern: 'storage-video-upload-fail',
    registerStream: (): void => {
      globalStreamRegistry.append({
        name: 'storage-video-stream',
        subjects: ['storage-video-upload-fail'],
      });
    },
  },
};

export const NatsVideoTransport = {
  ...NatsVideoEventPattern,
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-video-upload-finish')(
        constructor.prototype['onUploadFinish'],
        'onUploadFinish',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUploadFinish'),
      );
      NatsVideoEventPattern.UPLOAD_FINISH.registerStream();
      EventPattern('storage-video-upload-fail')(
        constructor.prototype['onUploadFail'],
        'onUploadFail',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUploadFail'),
      );
      NatsVideoEventPattern.UPLOAD_FAIL.registerStream();
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: VideoEventBus,
} as const;

export interface NatsVideoEventController {
  onUploadFinish(
    event: NestStorage.Video,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
  onUploadFail(
    event: NestStorage.Video,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsVideoUploadFinishEventHandler {
  onVideoUploadFinish(
    event: NestStorage.Video,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsVideoUploadFailEventHandler {
  onVideoUploadFail(
    event: NestStorage.Video,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

class NatsClientImpl {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}

  protected emitMany<T>(pattern: string, events: T[]): Observable<any[]> {
    const observables = events.map((event) => this.client.emit(pattern, event));
    return concat(...observables).pipe(toArray());
  }
}

class NatsUserEventBusClientImpl extends NatsClientImpl implements UserEventBus {
  constructor(protected readonly client: NatsJetStreamClientProxy) {
    super(client);
  }

  emitCreate(event: NestAuth.User): Promise<any> {
    return firstValueFrom(this.client.emit('auth-user-create', event));
  }

  emitManyCreate(events: NestAuth.User[]): Promise<any[]> {
    return lastValueFrom(this.emitMany('auth-user-create', events));
  }
}

class NatsImageEventBusClientImpl extends NatsClientImpl implements ImageEventBus {
  constructor(protected readonly client: NatsJetStreamClientProxy) {
    super(client);
  }

  emitDelete(event: NestStorage.Image): Promise<any> {
    return firstValueFrom(this.client.emit('storage-image-delete', event));
  }

  emitManyDelete(events: NestStorage.Image[]): Promise<any[]> {
    return lastValueFrom(this.emitMany('storage-image-delete', events));
  }
}

class NatsStorageObjectEventBusClientImpl extends NatsClientImpl implements StorageObjectEventBus {
  constructor(protected readonly client: NatsJetStreamClientProxy) {
    super(client);
  }

  emitParentUpdate(event: StorageObjectParentUpdateEvent): Promise<any> {
    return firstValueFrom(this.client.emit('storage-storage-object-parent-update', event));
  }

  emitManyParentUpdate(events: StorageObjectParentUpdateEvent[]): Promise<any[]> {
    return lastValueFrom(this.emitMany('storage-storage-object-parent-update', events));
  }
}

class NatsVideoEventBusClientImpl extends NatsClientImpl implements VideoEventBus {
  constructor(protected readonly client: NatsJetStreamClientProxy) {
    super(client);
  }

  emitUploadFinish(event: NestStorage.Video): Promise<any> {
    return firstValueFrom(this.client.emit('storage-video-upload-finish', event));
  }

  emitManyUploadFinish(events: NestStorage.Video[]): Promise<any[]> {
    return lastValueFrom(this.emitMany('storage-video-upload-finish', events));
  }

  emitUploadFail(event: NestStorage.Video): Promise<any> {
    return firstValueFrom(this.client.emit('storage-video-upload-fail', event));
  }

  emitManyUploadFail(events: NestStorage.Video[]): Promise<any[]> {
    return lastValueFrom(this.emitMany('storage-video-upload-fail', events));
  }
}

export class NatsClientFactory {
  private static clientsMap = new Map<Abstract<EventBus>, Type>([
    [UserEventBus, NatsUserEventBusClientImpl],
    [ImageEventBus, NatsImageEventBusClientImpl],
    [StorageObjectEventBus, NatsStorageObjectEventBusClientImpl],
    [VideoEventBus, NatsVideoEventBusClientImpl],
  ]);

  static create(client: NatsJetStreamClientProxy, EventBusClass: Abstract<EventBus>): Type {
    const Client = this.clientsMap.get(EventBusClass);

    if (!Client) {
      throw new Error(`Nats client for ${EventBusClass} not found`);
    }

    return new Client(client);
  }
}
