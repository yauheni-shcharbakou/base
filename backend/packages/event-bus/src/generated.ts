/* eslint-disable */
import type { NestCommon } from '@backend/proto';
import { type Observable } from 'rxjs';
import { ProviderIdEvent, StorageObjectUpdateParentEvent, VideoUpdateOneEvent } from './events';

export interface AuthUserEventBus {
  onCreateOne(event: NestCommon.IdField): Observable<any>;
}

export interface StorageFileEventBus {
  onDeleteOne(event: ProviderIdEvent): Observable<any>;
}

export interface StorageStorageObjectEventBus {
  onUpdateParent(event: StorageObjectUpdateParentEvent): Observable<any>;
}

export interface StorageVideoEventBus {
  onDeleteOne(event: ProviderIdEvent): Observable<any>;
  onUpdateOne(event: VideoUpdateOneEvent): Observable<any>;
}

export enum EventBusHost {
  AUTH = 'auth',
  STORAGE = 'storage',
}

export type EventBusService =
  | 'auth.user'
  | 'storage.file'
  | 'storage.storageObject'
  | 'storage.video';
