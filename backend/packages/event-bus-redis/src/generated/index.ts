/* eslint-disable */
import { RedisQueueClient } from '@/infrastructure/clients';
import { RedisJobContext } from '@/interface/contexts';
import {
  EventBus,
  FileEventBus,
  FilePurgeEvent,
  UserEventBus,
  VideoEventBus,
} from '@backend/event-bus';
import type { NestAuth, NestStorage } from '@backend/proto';
import { Abstract, applyDecorators, Type } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { Observable } from 'rxjs';

const RedisUserEventPattern = {
  CREATE: {
    pattern: 'auth.user.create',
  },
  DELETE: {
    pattern: 'auth.user.delete',
  },
};

export const RedisUserTransport = {
  ...RedisUserEventPattern,
  /**
   * Binds the service's own events. The patterns stay bare event ids here —
   * `@RedisController({ consumer })` rewrites them into `<eventId>@<consumerId>`
   * queue names, so it must be applied above this decorator.
   */
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('auth.user.create')(
        constructor.prototype['onCreate'],
        'onCreate',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onCreate'),
      );
      EventPattern('auth.user.delete')(
        constructor.prototype['onDelete'],
        'onDelete',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onDelete'),
      );
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: UserEventBus,
} as const;

export interface RedisUserEventController {
  onCreate(
    event: NestAuth.User,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
  onDelete(
    event: NestAuth.User,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
}

export interface RedisUserCreateEventHandler {
  onUserCreate(
    event: NestAuth.User,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
}

export interface RedisUserDeleteEventHandler {
  onUserDelete(
    event: NestAuth.User,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
}

const RedisFileEventPattern = {
  PURGE: {
    pattern: 'storage.file.purge',
  },
  READY: {
    pattern: 'storage.file.ready',
  },
};

export const RedisFileTransport = {
  ...RedisFileEventPattern,
  /**
   * Binds the service's own events. The patterns stay bare event ids here —
   * `@RedisController({ consumer })` rewrites them into `<eventId>@<consumerId>`
   * queue names, so it must be applied above this decorator.
   */
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage.file.purge')(
        constructor.prototype['onPurge'],
        'onPurge',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onPurge'),
      );
      EventPattern('storage.file.ready')(
        constructor.prototype['onReady'],
        'onReady',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onReady'),
      );
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: FileEventBus,
} as const;

export interface RedisFileEventController {
  onPurge(
    event: FilePurgeEvent,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
  onReady(
    event: NestStorage.File,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
}

export interface RedisFilePurgeEventHandler {
  onFilePurge(
    event: FilePurgeEvent,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
}

export interface RedisFileReadyEventHandler {
  onFileReady(
    event: NestStorage.File,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
}

const RedisVideoEventPattern = {
  UPLOADED: {
    pattern: 'storage.video.uploaded',
  },
  UPLOAD_FINISH: {
    pattern: 'storage.video.upload.finish',
  },
  UPLOAD_FAIL: {
    pattern: 'storage.video.upload.fail',
  },
};

export const RedisVideoTransport = {
  ...RedisVideoEventPattern,
  /**
   * Binds the service's own events. The patterns stay bare event ids here —
   * `@RedisController({ consumer })` rewrites them into `<eventId>@<consumerId>`
   * queue names, so it must be applied above this decorator.
   */
  ControllerMethods: (): ClassDecorator => {
    const methodsDecorator = function (constructor: Function) {
      EventPattern('storage.video.uploaded')(
        constructor.prototype['onUploaded'],
        'onUploaded',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUploaded'),
      );
      EventPattern('storage.video.upload.finish')(
        constructor.prototype['onUploadFinish'],
        'onUploadFinish',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUploadFinish'),
      );
      EventPattern('storage.video.upload.fail')(
        constructor.prototype['onUploadFail'],
        'onUploadFail',
        Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUploadFail'),
      );
    };
    return applyDecorators(methodsDecorator);
  },
  EventBus: VideoEventBus,
} as const;

export interface RedisVideoEventController {
  onUploaded(
    event: NestStorage.Video,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
  onUploadFinish(
    event: NestStorage.Video,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
  onUploadFail(
    event: NestStorage.Video,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
}

export interface RedisVideoUploadedEventHandler {
  onVideoUploaded(
    event: NestStorage.Video,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
}

export interface RedisVideoUploadFinishEventHandler {
  onVideoUploadFinish(
    event: NestStorage.Video,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
}

export interface RedisVideoUploadFailEventHandler {
  onVideoUploadFail(
    event: NestStorage.Video,
    context?: RedisJobContext,
  ): void | Promise<void> | Observable<void>;
}

class RedisClientImpl {
  constructor(protected readonly client: RedisQueueClient) {}
}

class RedisUserEventBusClientImpl extends RedisClientImpl implements UserEventBus {
  constructor(protected readonly client: RedisQueueClient) {
    super(client);
  }

  emitCreate(event: NestAuth.User): Promise<any> {
    return this.client.emit('auth.user.create', event);
  }

  emitManyCreate(events: NestAuth.User[]): Promise<any[]> {
    return this.client.emitMany('auth.user.create', events);
  }

  emitDelete(event: NestAuth.User): Promise<any> {
    return this.client.emit('auth.user.delete', event);
  }

  emitManyDelete(events: NestAuth.User[]): Promise<any[]> {
    return this.client.emitMany('auth.user.delete', events);
  }
}

class RedisFileEventBusClientImpl extends RedisClientImpl implements FileEventBus {
  constructor(protected readonly client: RedisQueueClient) {
    super(client);
  }

  emitPurge(event: FilePurgeEvent): Promise<any> {
    return this.client.emit('storage.file.purge', event);
  }

  emitManyPurge(events: FilePurgeEvent[]): Promise<any[]> {
    return this.client.emitMany('storage.file.purge', events);
  }

  emitReady(event: NestStorage.File): Promise<any> {
    return this.client.emit('storage.file.ready', event);
  }

  emitManyReady(events: NestStorage.File[]): Promise<any[]> {
    return this.client.emitMany('storage.file.ready', events);
  }
}

class RedisVideoEventBusClientImpl extends RedisClientImpl implements VideoEventBus {
  constructor(protected readonly client: RedisQueueClient) {
    super(client);
  }

  emitUploaded(event: NestStorage.Video): Promise<any> {
    return this.client.emit('storage.video.uploaded', event);
  }

  emitManyUploaded(events: NestStorage.Video[]): Promise<any[]> {
    return this.client.emitMany('storage.video.uploaded', events);
  }

  emitUploadFinish(event: NestStorage.Video): Promise<any> {
    return this.client.emit('storage.video.upload.finish', event);
  }

  emitManyUploadFinish(events: NestStorage.Video[]): Promise<any[]> {
    return this.client.emitMany('storage.video.upload.finish', events);
  }

  emitUploadFail(event: NestStorage.Video): Promise<any> {
    return this.client.emit('storage.video.upload.fail', event);
  }

  emitManyUploadFail(events: NestStorage.Video[]): Promise<any[]> {
    return this.client.emitMany('storage.video.upload.fail', events);
  }
}

export class RedisClientFactory {
  private static clientsMap = new Map<Abstract<EventBus>, Type>([
    [UserEventBus, RedisUserEventBusClientImpl],
    [FileEventBus, RedisFileEventBusClientImpl],
    [VideoEventBus, RedisVideoEventBusClientImpl],
  ]);

  static create(client: RedisQueueClient, EventBusClass: Abstract<EventBus>): Type {
    const Client = this.clientsMap.get(EventBusClass);

    if (!Client) {
      throw new Error(`Redis client for ${EventBusClass} not found`);
    }

    return new Client(client);
  }
}

/**
 * Events owned by each host. `RedisModule.forRoot({ host })` feeds the host's entry to the
 * mediator, which runs one fan-out worker per event queue listed here.
 */
export const REDIS_HOST_EVENTS: Record<string, readonly string[]> = {
  auth: ['auth.user.create', 'auth.user.delete'],
  storage: [
    'storage.file.purge',
    'storage.file.ready',
    'storage.video.uploaded',
    'storage.video.upload.finish',
    'storage.video.upload.fail',
  ],
};
