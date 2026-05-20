import type { NestAuth, NestStorage } from '@backend/proto';
import { StorageObjectUpdateParentEvent, VideoUpdateOneEvent } from './events';

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
    file: {
      delete: NestStorage.File;
    };
    storageObject: {
      updateParent: StorageObjectUpdateParentEvent;
    };
    video: {
      delete: NestStorage.Video;
      update: VideoUpdateOneEvent;
    };
  };
}
