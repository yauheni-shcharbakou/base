import {
  ProviderIdEvent,
  StorageObjectUpdateParentEvent,
  VideoUpdateOneEvent,
} from '@/event-bus/strategy/events';
import type { NestCommon } from '@backend/proto';

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
      createOne: NestCommon.IdField;
    };
    tempCode: {
      deactivateOne: NestCommon.IdField;
    };
  };
  storage: {
    file: {
      deleteOne: ProviderIdEvent;
    };
    storageObject: {
      updateParent: StorageObjectUpdateParentEvent;
    };
    video: {
      deleteOne: ProviderIdEvent;
      updateOne: VideoUpdateOneEvent;
    };
  };
}
