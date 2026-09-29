import { FileEventBus, FilePurgeEvent, FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { Injectable, Logger } from '@nestjs/common';
import _ from 'lodash';

/**
 * A deleted file row, with the video or image it backed — enough to know what it left behind.
 */
export type FilePurgeTarget = Pick<NestStorage.File, 'id' | 'providerId'> & {
  video?: Pick<NestStorage.Video, 'providerId'>;
  image?: Pick<NestStorage.Image, 'previewProviderId'>;
};

/**
 * Hands provider objects to the purge consumer once their rows are gone. Called after the delete,
 * never before: a purge that ran ahead of a delete that then failed would leave a row with nothing
 * behind it. The window this leaves is an emit that fails after the delete — logged, and the object
 * stays at the provider as an orphan.
 */
@Injectable()
export class FilePurgeService {
  private readonly logger = new Logger(FilePurgeService.name);

  constructor(private readonly eventBus: FileEventBus) {}

  async purge(events: FilePurgeEvent[]): Promise<void> {
    if (!events.length) {
      return;
    }

    try {
      await this.eventBus.emitManyPurge(events);
    } catch (error) {
      this.logger.error(
        `Failed to schedule the purge of ${events.length} provider object(s): ` +
          _.map(events, 'providerId').join(', '),
        error?.stack,
      );
    }
  }

  // A video lives under the guid on its own row and never on its backing file; a plain file or an
  // image lives under the file row's `providerId`. A row with neither never reached the provider.
  async purgeFiles(files: FilePurgeTarget[]): Promise<void> {
    const events = _.flatMap(files, (file): FilePurgeEvent[] => {
      if (file.video?.providerId) {
        return [{ type: FilePurgeType.VIDEO, providerId: file.video.providerId }];
      }

      return file.providerId ? toFileEvents(file.providerId, file.image?.previewProviderId) : [];
    });

    await this.purge(events);
  }
}

/**
 * The objects an image or plain file leaves in Bunny Storage: its own key, and an image's preview
 * when that is a separate object — a light original is its own preview, deleted once.
 */
export function toFileEvents(providerId: string, previewProviderId?: string): FilePurgeEvent[] {
  return _.uniq(_.compact([providerId, previewProviderId])).map((key) => ({
    type: FilePurgeType.FILE,
    providerId: key,
  }));
}
