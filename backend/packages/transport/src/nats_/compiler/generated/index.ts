/* eslint-disable */
import { GrpcIdField } from "@backend/grpc";
import { NatsJetStreamClientProxy, NatsJetStreamContext } from "@nestjs-plugins/nestjs-nats-jetstream-transport";
import { applyDecorators, Controller, UseInterceptors } from "@nestjs/common";
import { EventPattern } from "@nestjs/microservices";
import { ProviderIdEvent, StorageObjectUpdateParentEvent, VideoUpdateOneEvent } from "nats_/compiler/strategy/events";
import { Observable } from "rxjs";
import { NatsControllerInterceptor } from "../../interceptors";
import { globalStreamRegistry } from "../../utils";

const NatsUserEventPattern = {
  CREATE_ONE: {
      pattern: 'auth.user.create.one',
      registerStream: (): void => {
          globalStreamRegistry.append({ name: 'auth-user-stream', subjects: ['auth.user.create.one'] });
      },
  },
};

export const NatsUserTransport = {
  ...NatsUserEventPattern,
  Controller: (): ClassDecorator => {
      const methodsDecorator = function(constructor: Function) {
          EventPattern('auth.user.create.one')(
              constructor.prototype['onCreateOne'],
              'onCreateOne',
              Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onCreateOne')
          );
          NatsUserEventPattern.CREATE_ONE.registerStream();
      };
      return applyDecorators(Controller(), UseInterceptors(NatsControllerInterceptor), methodsDecorator);
  },
} as const;

export interface NatsUserEventController {
  onCreateOne(
      event: GrpcIdField,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}
export interface NatsUserCreateOneEventHandler {
  onUserCreateOne(
      event: GrpcIdField,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsTempCodeEventPattern = {
  DEACTIVATE_ONE: {
      pattern: 'auth.temp.code.deactivate.one',
      registerStream: (): void => {
          globalStreamRegistry.append({ name: 'auth-temp-code-stream', subjects: ['auth.temp.code.deactivate.one'] });
      },
  },
};

export const NatsTempCodeTransport = {
  ...NatsTempCodeEventPattern,
  Controller: (): ClassDecorator => {
      const methodsDecorator = function(constructor: Function) {
          EventPattern('auth.temp.code.deactivate.one')(
              constructor.prototype['onDeactivateOne'],
              'onDeactivateOne',
              Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onDeactivateOne')
          );
          NatsTempCodeEventPattern.DEACTIVATE_ONE.registerStream();
      };
      return applyDecorators(Controller(), UseInterceptors(NatsControllerInterceptor), methodsDecorator);
  },
} as const;

export interface NatsTempCodeEventController {
  onDeactivateOne(
      event: GrpcIdField,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}
export interface NatsTempCodeDeactivateOneEventHandler {
  onTempCodeDeactivateOne(
      event: GrpcIdField,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsFileEventPattern = {
  DELETE_ONE: {
      pattern: 'storage.file.delete.one',
      registerStream: (): void => {
          globalStreamRegistry.append({ name: 'storage-file-stream', subjects: ['storage.file.delete.one'] });
      },
  },
};

export const NatsFileTransport = {
  ...NatsFileEventPattern,
  Controller: (): ClassDecorator => {
      const methodsDecorator = function(constructor: Function) {
          EventPattern('storage.file.delete.one')(
              constructor.prototype['onDeleteOne'],
              'onDeleteOne',
              Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onDeleteOne')
          );
          NatsFileEventPattern.DELETE_ONE.registerStream();
      };
      return applyDecorators(Controller(), UseInterceptors(NatsControllerInterceptor), methodsDecorator);
  },
} as const;

export interface NatsFileEventController {
  onDeleteOne(
      event: ProviderIdEvent,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}
export interface NatsFileDeleteOneEventHandler {
  onFileDeleteOne(
      event: ProviderIdEvent,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsStorageObjectEventPattern = {
  UPDATE_PARENT: {
      pattern: 'storage.storage.object.update.parent',
      registerStream: (): void => {
          globalStreamRegistry.append({ name: 'storage-storage-object-stream', subjects: ['storage.storage.object.update.parent'] });
      },
  },
};

export const NatsStorageObjectTransport = {
  ...NatsStorageObjectEventPattern,
  Controller: (): ClassDecorator => {
      const methodsDecorator = function(constructor: Function) {
          EventPattern('storage.storage.object.update.parent')(
              constructor.prototype['onUpdateParent'],
              'onUpdateParent',
              Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUpdateParent')
          );
          NatsStorageObjectEventPattern.UPDATE_PARENT.registerStream();
      };
      return applyDecorators(Controller(), UseInterceptors(NatsControllerInterceptor), methodsDecorator);
  },
} as const;

export interface NatsStorageObjectEventController {
  onUpdateParent(
      event: StorageObjectUpdateParentEvent,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}
export interface NatsStorageObjectUpdateParentEventHandler {
  onStorageObjectUpdateParent(
      event: StorageObjectUpdateParentEvent,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

const NatsVideoEventPattern = {
  DELETE_ONE: {
      pattern: 'storage.video.delete.one',
      registerStream: (): void => {
          globalStreamRegistry.append({ name: 'storage-video-stream', subjects: ['storage.video.delete.one'] });
      },
  },
  UPDATE_ONE: {
      pattern: 'storage.video.update.one',
      registerStream: (): void => {
          globalStreamRegistry.append({ name: 'storage-video-stream', subjects: ['storage.video.update.one'] });
      },
  },
};

export const NatsVideoTransport = {
  ...NatsVideoEventPattern,
  Controller: (): ClassDecorator => {
      const methodsDecorator = function(constructor: Function) {
          EventPattern('storage.video.delete.one')(
              constructor.prototype['onDeleteOne'],
              'onDeleteOne',
              Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onDeleteOne')
          );
          NatsVideoEventPattern.DELETE_ONE.registerStream();
          EventPattern('storage.video.update.one')(
              constructor.prototype['onUpdateOne'],
              'onUpdateOne',
              Reflect.getOwnPropertyDescriptor(constructor.prototype, 'onUpdateOne')
          );
          NatsVideoEventPattern.UPDATE_ONE.registerStream();
      };
      return applyDecorators(Controller(), UseInterceptors(NatsControllerInterceptor), methodsDecorator);
  },
} as const;

export interface NatsVideoEventController {
  onDeleteOne(
      event: ProviderIdEvent,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
  onUpdateOne(
      event: VideoUpdateOneEvent,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}
export interface NatsVideoDeleteOneEventHandler {
  onVideoDeleteOne(
      event: ProviderIdEvent,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}
export interface NatsVideoUpdateOneEventHandler {
  onVideoUpdateOne(
      event: VideoUpdateOneEvent,
      context?: NatsJetStreamContext,
  ): void | Promise<void> | Observable<void>;
}

interface NatsAuthUserClient {
  createOne(data: GrpcIdField): Observable<any>;
}


class NatsAuthUserClientImpl implements NatsAuthUserClient {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}
  createOne(data: GrpcIdField): Observable<any> {
      return this.client.emit('auth.user.create.one', data);
  }
}

interface NatsAuthTempCodeClient {
  deactivateOne(data: GrpcIdField): Observable<any>;
}


class NatsAuthTempCodeClientImpl implements NatsAuthTempCodeClient {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}
  deactivateOne(data: GrpcIdField): Observable<any> {
      return this.client.emit('auth.temp.code.deactivate.one', data);
  }
}

interface NatsAuthClient {
  readonly user: NatsAuthUserClient;
  readonly tempCode: NatsAuthTempCodeClient;
}

class NatsAuthClientImpl implements NatsAuthClient {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}
  readonly user = new NatsAuthUserClientImpl(this.client);
  readonly tempCode = new NatsAuthTempCodeClientImpl(this.client);
}

interface NatsStorageFileClient {
  deleteOne(data: ProviderIdEvent): Observable<any>;
}


class NatsStorageFileClientImpl implements NatsStorageFileClient {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}
  deleteOne(data: ProviderIdEvent): Observable<any> {
      return this.client.emit('storage.file.delete.one', data);
  }
}

interface NatsStorageStorageObjectClient {
  updateParent(data: StorageObjectUpdateParentEvent): Observable<any>;
}


class NatsStorageStorageObjectClientImpl implements NatsStorageStorageObjectClient {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}
  updateParent(data: StorageObjectUpdateParentEvent): Observable<any> {
      return this.client.emit('storage.storage.object.update.parent', data);
  }
}

interface NatsStorageVideoClient {
  deleteOne(data: ProviderIdEvent): Observable<any>;
  updateOne(data: VideoUpdateOneEvent): Observable<any>;
}


class NatsStorageVideoClientImpl implements NatsStorageVideoClient {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}
  deleteOne(data: ProviderIdEvent): Observable<any> {
      return this.client.emit('storage.video.delete.one', data);
  }
  updateOne(data: VideoUpdateOneEvent): Observable<any> {
      return this.client.emit('storage.video.update.one', data);
  }
}

interface NatsStorageClient {
  readonly file: NatsStorageFileClient;
  readonly storageObject: NatsStorageStorageObjectClient;
  readonly video: NatsStorageVideoClient;
}

class NatsStorageClientImpl implements NatsStorageClient {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}
  readonly file = new NatsStorageFileClientImpl(this.client);
  readonly storageObject = new NatsStorageStorageObjectClientImpl(this.client);
  readonly video = new NatsStorageVideoClientImpl(this.client);
}

export interface NatsClient {
  readonly auth: NatsAuthClient;
  readonly storage: NatsStorageClient;
}

export class GeneratedNatsClientImpl implements NatsClient {
  constructor(protected readonly client: NatsJetStreamClientProxy) {}
  readonly auth = new NatsAuthClientImpl(this.client);
  readonly storage = new NatsStorageClientImpl(this.client);
}






