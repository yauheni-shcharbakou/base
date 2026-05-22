/* eslint-disable */
import { globalStreamRegistry } from '@/infrastructure/utils';
import {
  AuthUserEventBus,
  EventBus,
  StorageImageEventBus,
  StorageObjectParentUpdateEvent,
  StorageStorageObjectEventBus,
  StorageVideoEventBus,
} from '@backend/event-bus';
import type { NestAuth, NestStorage } from '@backend/proto';
import {
  NatsJetStreamClientProxy,
  NatsJetStreamContext,
} from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { Abstract, applyDecorators, Type } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { concat, firstValueFrom, lastValueFrom, Observable, toArray } from 'rxjs';

const NatsAuthUserEventPattern = {
  CREATE: {
    pattern: 'auth-user-create',
    registerStream: (): void => {
      globalStreamRegistry.append({ name: 'auth-user-stream', subjects: ['auth-user-create'] });
    },
  },
};

export const NatsAuthUserTransport = {
  ...NatsAuthUserEventPattern,
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('auth-user-create')(
        constructor.prototype['onCreate'],
        'onCreate',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onCreate'),
      );
      NatsAuthUserEventPattern.CREATE.registerStream();
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: AuthUserEventBus,
} as const;

export interface NatsAuthUserEventController {
  onCreate(
    event: NestAuth.User,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsAuthUserCreateEventHandler {
  onAuthUserCreate(
    event: NestAuth.User,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsStorageImageEventPattern = {
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

export const NatsStorageImageTransport = {
  ...NatsStorageImageEventPattern,
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-image-delete')(
        constructor.prototype['onDelete'],
        'onDelete',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onDelete'),
      );
      NatsStorageImageEventPattern.DELETE.registerStream();
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: StorageImageEventBus,
} as const;

export interface NatsStorageImageEventController {
  onDelete(
    event: NestStorage.Image,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsStorageImageDeleteEventHandler {
  onStorageImageDelete(
    event: NestStorage.Image,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsStorageStorageObjectEventPattern = {
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

export const NatsStorageStorageObjectTransport = {
  ...NatsStorageStorageObjectEventPattern,
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-storage-object-parent-update')(
        constructor.prototype['onParentUpdate'],
        'onParentUpdate',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onParentUpdate'),
      );
      NatsStorageStorageObjectEventPattern.PARENT_UPDATE.registerStream();
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: StorageStorageObjectEventBus,
} as const;

export interface NatsStorageStorageObjectEventController {
  onParentUpdate(
    event: StorageObjectParentUpdateEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsStorageStorageObjectParentUpdateEventHandler {
  onStorageStorageObjectParentUpdate(
    event: StorageObjectParentUpdateEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsStorageVideoEventPattern = {
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

export const NatsStorageVideoTransport = {
  ...NatsStorageVideoEventPattern,
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-video-upload-finish')(
        constructor.prototype['onUploadFinish'],
        'onUploadFinish',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUploadFinish'),
      );
      NatsStorageVideoEventPattern.UPLOAD_FINISH.registerStream();
      EventPattern('storage-video-upload-fail')(
        constructor.prototype['onUploadFail'],
        'onUploadFail',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUploadFail'),
      );
      NatsStorageVideoEventPattern.UPLOAD_FAIL.registerStream();
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: StorageVideoEventBus,
} as const;

export interface NatsStorageVideoEventController {
  onUploadFinish(
    event: NestStorage.Video,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
  onUploadFail(
    event: NestStorage.Video,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsStorageVideoUploadFinishEventHandler {
  onStorageVideoUploadFinish(
    event: NestStorage.Video,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsStorageVideoUploadFailEventHandler {
  onStorageVideoUploadFail(
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

class NatsAuthUserEventBusClientImpl extends NatsClientImpl implements AuthUserEventBus {
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

class NatsStorageImageEventBusClientImpl extends NatsClientImpl implements StorageImageEventBus {
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

class NatsStorageStorageObjectEventBusClientImpl
  extends NatsClientImpl
  implements StorageStorageObjectEventBus
{
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

class NatsStorageVideoEventBusClientImpl extends NatsClientImpl implements StorageVideoEventBus {
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
    [AuthUserEventBus, NatsAuthUserEventBusClientImpl],
    [StorageImageEventBus, NatsStorageImageEventBusClientImpl],
    [StorageStorageObjectEventBus, NatsStorageStorageObjectEventBusClientImpl],
    [StorageVideoEventBus, NatsStorageVideoEventBusClientImpl],
  ]);

  static create(client: NatsJetStreamClientProxy, EventBusClass: Abstract<EventBus>): Type {
    const Client = this.clientsMap.get(EventBusClass);

    if (!Client) {
      throw new Error(`Nats client for ${EventBusClass} not found`);
    }

    return new Client(client);
  }
}
