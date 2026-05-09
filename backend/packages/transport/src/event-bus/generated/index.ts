/* eslint-disable */
import {
  ProviderIdEvent,
  StorageObjectUpdateParentEvent,
  VideoUpdateOneEvent,
} from '@/event-bus/strategy/events';
import type { NestCommon } from '@backend/proto';
import { type Observable } from 'rxjs';

export interface AuthUserEventBus {
  createOne(event: NestCommon.IdField): Observable<any>;
}

export interface AuthTempCodeEventBus {
  deactivateOne(event: NestCommon.IdField): Observable<any>;
}

export interface StorageFileEventBus {
  deleteOne(event: ProviderIdEvent): Observable<any>;
}

export interface StorageStorageObjectEventBus {
  updateParent(event: StorageObjectUpdateParentEvent): Observable<any>;
}

export interface StorageVideoEventBus {
  deleteOne(event: ProviderIdEvent): Observable<any>;
  updateOne(event: VideoUpdateOneEvent): Observable<any>;
}
