import { BulkUpdate } from '@backend/common';
import { VideoEventBus } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { StorageVideo } from '@modules/storage/domain/entities/storage.video.interface';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { Injectable, Logger } from '@nestjs/common';
import _ from 'lodash';

/**
 * Bunny's `VideoModelStatus` — the `status` carried by a video *object*. These are **not** the codes
 * its webhook posts (`BunnyStreamStatus`, next to the status use-case): "Finished" is 4 here and 3
 * there, so the two maps must never be used interchangeably.
 *
 * A plain map rather than an enum, for the same reason: foreign wire values compared as numbers.
 */
export const BunnyVideoStatus = {
  CREATED: 0,
  UPLOADED: 1,
  PROCESSING: 2,
  TRANSCODING: 3,
  FINISHED: 4,
  ERROR: 5,
  UPLOAD_FAILED: 6,
  JIT_SEGMENTING: 7,
  JIT_PLAYLISTS_CREATED: 8,
} as const;

@Injectable()
export class VideoSyncWithProviderUseCase {
  private readonly logger = new Logger(VideoSyncWithProviderUseCase.name);

  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
    private readonly eventBus: VideoEventBus,
  ) {}

  async execute() {
    let page = 1;
    let hasNext = true;
    const limit = 100;

    do {
      const { items, total } = await this.storageVideoService.getList(page, limit);

      await this.videoRepository.bulkUpdate(
        _.map(items, (item): BulkUpdate<NestStorage.Video> => {
          return {
            filter: {
              key: 'providerId',
              value: item.providerId,
            },
            update: {
              set: {
                duration: item.duration,
                views: item.views,
              },
            },
          };
        }),
      );

      await this.reconcileStalledUploads(items);

      hasNext = page * limit < total;
      page += 1;
    } while (hasNext);
  }

  /**
   * The webhook is the primary path to READY; this is the backstop. Bunny's callback is answered
   * 200 even when our own handling fails, and the signature covers the body alone, so a dropped or
   * mis-delivered status would otherwise park a row in UPLOADED forever — the cleanup cron
   * deliberately does not sweep that status — or leave an encoded video PENDING, then FAILED, for
   * that cron to delete. The provider's word is final either way: whatever the row says, a video
   * Bunny has encoded is READY.
   */
  private async reconcileStalledUploads(items: StorageVideo[]): Promise<void> {
    // An empty page must return early: `getMany` with no filter falls through to `findAll`, which
    // would load the whole table and re-emit for every video in it.
    if (!items.length) {
      return;
    }

    const statusByProviderId = new Map(_.map(items, (item) => [item.providerId, item.status]));

    const videos = await this.videoRepository.getMany<NestStorage.VideoPopulated>(
      { providerIds: _.map(items, 'providerId') },
      { populate: ['file'] },
    );

    // Only rows short of READY. Without this filter the cron would re-emit `uploadFinish` for
    // every encoded video in the library, every hour.
    const stalled = _.filter(
      videos,
      (video) => !!video.file && video.file.uploadStatus !== NestStorage.FileUploadStatus.READY,
    );

    for (const video of stalled) {
      const status = statusByProviderId.get(video.providerId);
      const { uploadStatus } = video.file;

      if (status === BunnyVideoStatus.FINISHED) {
        await this.eventBus.emitUploadFinish(video);
        this.logger.log(
          `Video ${video.id} reconciled from ${uploadStatus} to encoded, provider status ${status}`,
        );
        continue;
      }

      // A row already FAILED stays out: the provider keeps reporting its error until the cleanup
      // cron deletes the video, and each pass would emit the same event again.
      if (
        (status === BunnyVideoStatus.ERROR || status === BunnyVideoStatus.UPLOAD_FAILED) &&
        uploadStatus !== NestStorage.FileUploadStatus.FAILED
      ) {
        await this.eventBus.emitUploadFail(video);
        this.logger.warn(
          `Video ${video.id} reconciled from ${uploadStatus} to failed, provider status ${status}`,
        );
      }

      // Anything else means the upload or the encode is still running — leave the row alone.
    }
  }
}
