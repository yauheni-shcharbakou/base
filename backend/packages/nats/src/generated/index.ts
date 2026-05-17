/* eslint-disable */
import { globalStreamRegistry } from '@/infrastructure/utils';
import { NatsControllerInterceptor } from '@/interface/interceptors';
import {
  AuthUserEventBus,
  EventBus,
  ProviderIdEvent,
  StorageFileEventBus,
  StorageObjectUpdateParentEvent,
  StorageStorageObjectEventBus,
  StorageVideoEventBus,
  VideoUpdateOneEvent,
} from '@backend/event-bus';
import type { NestCommon } from '@backend/proto';
import {
  NatsJetStreamClientProxy,
  NatsJetStreamContext,
} from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { Abstract, applyDecorators, Controller, Type, UseInterceptors } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { Observable } from 'rxjs';

const NatsAuthUserEventPattern = {
  CREATE_ONE: {
    pattern: 'auth-user-create-one',
    registerStream: (): void => {
      globalStreamRegistry.append({ name: 'auth-user-stream', subjects: ['auth-user-create-one'] });
    },
  },
};

export const NatsAuthUserTransport = {
  ...NatsAuthUserEventPattern,
  Controller: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('auth-user-create-one')(
        constructor.prototype['onCreateOne'],
        'onCreateOne',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onCreateOne'),
      );
      NatsAuthUserEventPattern.CREATE_ONE.registerStream();
    };
    return applyDecorators(
      Controller(),
      UseInterceptors(NatsControllerInterceptor),
      methodsDecorator,
    );
  },
  EventBus: AuthUserEventBus,
} as const;

export interface NatsAuthUserEventController {
  onCreateOne(
    event: NestCommon.IdField,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}
export interface NatsAuthUserCreateOneEventHandler {
  onAuthUserCreateOne(
    event: NestCommon.IdField,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsStorageFileEventPattern = {
  DELETE_ONE: {
    pattern: 'storage-file-delete-one',
    registerStream: (): void => {
      globalStreamRegistry.append({
        name: 'storage-file-stream',
        subjects: ['storage-file-delete-one'],
      });
    },
  },
};

export const NatsStorageFileTransport = {
  ...NatsStorageFileEventPattern,
  Controller: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-file-delete-one')(
        constructor.prototype['onDeleteOne'],
        'onDeleteOne',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onDeleteOne'),
      );
      NatsStorageFileEventPattern.DELETE_ONE.registerStream();
    };
    return applyDecorators(
      Controller(),
      UseInterceptors(NatsControllerInterceptor),
      methodsDecorator,
    );
  },
  EventBus: StorageFileEventBus,
} as const;

export interface NatsStorageFileEventController {
  onDeleteOne(
    event: ProviderIdEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}
export interface NatsStorageFileDeleteOneEventHandler {
  onStorageFileDeleteOne(
    event: ProviderIdEvent,
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
  Controller: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-storage-object-update-parent')(
        constructor.prototype['onUpdateParent'],
        'onUpdateParent',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUpdateParent'),
      );
      NatsStorageStorageObjectEventPattern.UPDATE_PARENT.registerStream();
    };
    return applyDecorators(
      Controller(),
      UseInterceptors(NatsControllerInterceptor),
      methodsDecorator,
    );
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
  DELETE_ONE: {
    pattern: 'storage-video-delete-one',
    registerStream: (): void => {
      globalStreamRegistry.append({
        name: 'storage-video-stream',
        subjects: ['storage-video-delete-one'],
      });
    },
  },
  UPDATE_ONE: {
    pattern: 'storage-video-update-one',
    registerStream: (): void => {
      globalStreamRegistry.append({
        name: 'storage-video-stream',
        subjects: ['storage-video-update-one'],
      });
    },
  },
};

export const NatsStorageVideoTransport = {
  ...NatsStorageVideoEventPattern,
  Controller: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage-video-delete-one')(
        constructor.prototype['onDeleteOne'],
        'onDeleteOne',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onDeleteOne'),
      );
      NatsStorageVideoEventPattern.DELETE_ONE.registerStream();
      EventPattern('storage-video-update-one')(
        constructor.prototype['onUpdateOne'],
        'onUpdateOne',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUpdateOne'),
      );
      NatsStorageVideoEventPattern.UPDATE_ONE.registerStream();
    };
    return applyDecorators(
      Controller(),
      UseInterceptors(NatsControllerInterceptor),
      methodsDecorator,
    );
  },
  EventBus: StorageVideoEventBus,
} as const;

export interface NatsStorageVideoEventController {
  onDeleteOne(
    event: ProviderIdEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
  onUpdateOne(
    event: VideoUpdateOneEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}
export interface NatsStorageVideoDeleteOneEventHandler {
  onStorageVideoDeleteOne(
    event: ProviderIdEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}
export interface NatsStorageVideoUpdateOneEventHandler {
  onStorageVideoUpdateOne(
    event: VideoUpdateOneEvent,
    context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

class NatsAuthUserEventBusClientImpl implements AuthUserEventBus {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}

  onCreateOne(data: NestCommon.IdField): Observable<any> {
    return this.client.emit('auth-user-create-one', data);
  }
}

class NatsStorageFileEventBusClientImpl implements StorageFileEventBus {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}

  onDeleteOne(data: ProviderIdEvent): Observable<any> {
    return this.client.emit('storage-file-delete-one', data);
  }
}

class NatsStorageStorageObjectEventBusClientImpl implements StorageStorageObjectEventBus {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}

  onUpdateParent(data: StorageObjectUpdateParentEvent): Observable<any> {
    return this.client.emit('storage-storage-object-update-parent', data);
  }
}

class NatsStorageVideoEventBusClientImpl implements StorageVideoEventBus {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}

  onDeleteOne(data: ProviderIdEvent): Observable<any> {
    return this.client.emit('storage-video-delete-one', data);
  }

  onUpdateOne(data: VideoUpdateOneEvent): Observable<any> {
    return this.client.emit('storage-video-update-one', data);
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
