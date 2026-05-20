/* eslint-disable */
import { globalStreamRegistry } from '@/infrastructure/utils';
import {
  AuthUserEventBus,
  EventBus,
  StorageFileEventBus,
  StorageObjectUpdateParentEvent,
  StorageStorageObjectEventBus,
  StorageVideoEventBus,
  VideoUpdateOneEvent,
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

const NatsStorageFileEventPattern = {
  DELETE: {
    pattern: 'storage-file-delete',
    registerStream: (): void => {
      globalStreamRegistry.append({
        name: 'storage-file-stream',
        subjects: ['storage-file-delete'],
      });
    },
  },
};

export const NatsStorageFileTransport = {
  ...NatsStorageFileEventPattern,
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-file-delete')(
        constructor.prototype['onDelete'],
        'onDelete',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onDelete'),
      );
      NatsStorageFileEventPattern.DELETE.registerStream();
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: StorageFileEventBus,
} as const;

export interface NatsStorageFileEventController {
  onDelete(
    event: NestStorage.File,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsStorageFileDeleteEventHandler {
  onStorageFileDelete(
    event: NestStorage.File,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsStorageStorageObjectEventPattern = {
  UPDATE_PARENT: {
    pattern: 'storage-storage-object-update-parent',
    registerStream: (): void => {
      globalStreamRegistry.append({
        name: 'storage-storage-object-stream',
        subjects: ['storage-storage-object-update-parent'],
      });
    },
  },
};

export const NatsStorageStorageObjectTransport = {
  ...NatsStorageStorageObjectEventPattern,
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-storage-object-update-parent')(
        constructor.prototype['onUpdateParent'],
        'onUpdateParent',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUpdateParent'),
      );
      NatsStorageStorageObjectEventPattern.UPDATE_PARENT.registerStream();
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: StorageStorageObjectEventBus,
} as const;

export interface NatsStorageStorageObjectEventController {
  onUpdateParent(
    event: StorageObjectUpdateParentEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsStorageStorageObjectUpdateParentEventHandler {
  onStorageStorageObjectUpdateParent(
    event: StorageObjectUpdateParentEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsStorageVideoEventPattern = {
  DELETE: {
    pattern: 'storage-video-delete',
    registerStream: (): void => {
      globalStreamRegistry.append({
        name: 'storage-video-stream',
        subjects: ['storage-video-delete'],
      });
    },
  },
  UPDATE: {
    pattern: 'storage-video-update',
    registerStream: (): void => {
      globalStreamRegistry.append({
        name: 'storage-video-stream',
        subjects: ['storage-video-update'],
      });
    },
  },
};

export const NatsStorageVideoTransport = {
  ...NatsStorageVideoEventPattern,
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-video-delete')(
        constructor.prototype['onDelete'],
        'onDelete',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onDelete'),
      );
      NatsStorageVideoEventPattern.DELETE.registerStream();
      EventPattern('storage-video-update')(
        constructor.prototype['onUpdate'],
        'onUpdate',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUpdate'),
      );
      NatsStorageVideoEventPattern.UPDATE.registerStream();
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: StorageVideoEventBus,
} as const;

export interface NatsStorageVideoEventController {
  onDelete(
    event: NestStorage.Video,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
  onUpdate(
    event: VideoUpdateOneEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsStorageVideoDeleteEventHandler {
  onStorageVideoDelete(
    event: NestStorage.Video,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

export interface NatsStorageVideoUpdateEventHandler {
  onStorageVideoUpdate(
    event: VideoUpdateOneEvent,
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

class NatsStorageFileEventBusClientImpl extends NatsClientImpl implements StorageFileEventBus {
  constructor(protected readonly client: NatsJetStreamClientProxy) {
    super(client);
  }

  emitDelete(event: NestStorage.File): Promise<any> {
    return firstValueFrom(this.client.emit('storage-file-delete', event));
  }

  emitManyDelete(events: NestStorage.File[]): Promise<any[]> {
    return lastValueFrom(this.emitMany('storage-file-delete', events));
  }
}

class NatsStorageStorageObjectEventBusClientImpl
  extends NatsClientImpl
  implements StorageStorageObjectEventBus
{
  constructor(protected readonly client: NatsJetStreamClientProxy) {
    super(client);
  }

  emitUpdateParent(event: StorageObjectUpdateParentEvent): Promise<any> {
    return firstValueFrom(this.client.emit('storage-storage-object-update-parent', event));
  }

  emitManyUpdateParent(events: StorageObjectUpdateParentEvent[]): Promise<any[]> {
    return lastValueFrom(this.emitMany('storage-storage-object-update-parent', events));
  }
}

class NatsStorageVideoEventBusClientImpl extends NatsClientImpl implements StorageVideoEventBus {
  constructor(protected readonly client: NatsJetStreamClientProxy) {
    super(client);
  }

  emitDelete(event: NestStorage.Video): Promise<any> {
    return firstValueFrom(this.client.emit('storage-video-delete', event));
  }

  emitManyDelete(events: NestStorage.Video[]): Promise<any[]> {
    return lastValueFrom(this.emitMany('storage-video-delete', events));
  }

  emitUpdate(event: VideoUpdateOneEvent): Promise<any> {
    return firstValueFrom(this.client.emit('storage-video-update', event));
  }

  emitManyUpdate(events: VideoUpdateOneEvent[]): Promise<any[]> {
    return lastValueFrom(this.emitMany('storage-video-update', events));
  }
}

export class NatsClientFactory {
  private static clientsMap = new Map<Abstract<EventBus>, Type>([
    [AuthUserEventBus, NatsAuthUserEventBusClientImpl],
    [StorageFileEventBus, NatsStorageFileEventBusClientImpl],
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
