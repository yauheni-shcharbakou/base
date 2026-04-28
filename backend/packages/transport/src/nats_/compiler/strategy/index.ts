import type { NestCommon } from '@backend/proto';
import {
  ProviderIdEvent,
  StorageObjectUpdateParentEvent,
  VideoUpdateOneEvent,
} from 'nats_/compiler/strategy/events';

/**
 * @description Add new nats events with their types here
 * @example should be in format:
 * {
 *   [host]: {
 *     [service]: {
 *       [event]: EventType
 *     }
 *   }
 * }
 */
export interface NatsStrategy {
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
