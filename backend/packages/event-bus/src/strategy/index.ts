import type { NestAuth, NestStorage } from '@backend/proto';
import { FilePurgeEvent } from './events';

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
      // Storage marks the user's tree deleted and drops every media the user owns, placed or not.
      delete: NestAuth.User;
    };
  };
  storage: {
    // Deletes one object from the provider once its rows are gone. The storage module consumes it,
    // so a provider that refuses a delete is retried instead of leaving an orphan behind.
    file: {
      purge: FilePurgeEvent;
    };
    // Three stages, in order: `uploaded` = the bytes reached Bunny, `uploadFinish` = Bunny finished
    // encoding and the video is playable, `uploadFail` = it will never play. The file module
    // consumes all three and maps them to UPLOADED / READY / FAILED.
    video: {
      uploaded: NestStorage.Video;
      uploadFinish: NestStorage.Video;
      uploadFail: NestStorage.Video;
    };
  };
}
