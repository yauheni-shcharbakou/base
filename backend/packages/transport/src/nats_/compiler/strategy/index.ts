import { GrpcIdField } from '@backend/grpc';
import {
  ProviderIdEvent,
  StorageObjectUpdateIsPublicEvent,
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
      createOne: GrpcIdField;
    };
    tempCode: {
      deactivateOne: GrpcIdField;
    };
  };
  storage: {
    file: {
      deleteOne: ProviderIdEvent;
    };
    storageObject: {
      updateIsPublic: StorageObjectUpdateIsPublicEvent;
    };
    video: {
      deleteOne: ProviderIdEvent;
      updateOne: VideoUpdateOneEvent;
    };
  };
}
