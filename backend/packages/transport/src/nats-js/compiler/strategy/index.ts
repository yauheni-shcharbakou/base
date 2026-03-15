import { ProviderIdEvent, StorageObjectUpdateIsPublicEvent, VideoUpdateOneEvent } from './events';

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
  auth: {};
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
