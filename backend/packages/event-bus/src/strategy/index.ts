import type { NestAuth, NestStorage } from '@backend/proto';
import { StorageObjectParentUpdateEvent } from './events';

/**
 * @description Add new events with their types here
 * @example should be in format:
 * {
 *   [host]: {
 *     [service]: {
 *       [event]: EventType
 *     }
 *   }
 * }
 */
export interface EventBusStrategy {
  auth: {
    user: {
      create: NestAuth.User;
    };
  };
  storage: {
    image: {
      delete: NestStorage.Image;
    };
    storageObject: {
      parentUpdate: StorageObjectParentUpdateEvent;
    };
    video: {
      uploadFinish: NestStorage.Video;
      uploadFail: NestStorage.Video;
    };
  };
}
