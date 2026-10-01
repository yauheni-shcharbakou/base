import { FilePurgeType, VideoEventBus } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { Injectable, Logger } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';

/**
 * Bunny Stream **webhook** status codes, as documented at https://bunny.net/docs/stream/webhooks.
 * Not to be confused with the `status` on a video *object* (`BunnyVideoStatus`, next to the sync
 * use-case), which numbers the same words differently — "Finished" is 3 here and 4 there.
 *
 * A plain map rather than an enum: these are someone else's wire values, and Bunny may send one
 * this list does not know about — comparing them as numbers is the honest shape.
 */
export const BunnyStreamStatus = {
  QUEUED: 0,
  PROCESSING: 1,
  ENCODING: 2,
  FINISHED: 3,
  RESOLUTION_FINISHED: 4,
  FAILED: 5,
  PRESIGNED_UPLOAD_STARTED: 6,
  PRESIGNED_UPLOAD_FINISHED: 7,
  PRESIGNED_UPLOAD_FAILED: 8,
  CAPTIONS_GENERATED: 9,
  TITLE_OR_DESCRIPTION_GENERATED: 10,
} as const;

// Derived from the map rather than written out, so the gloss cannot drift from the codes.
const BUNNY_STREAM_STATUS_NAMES: Record<number, string> = _.invert(BunnyStreamStatus);

@Injectable()
export class VideoHandleProviderStatusUseCase {
  private readonly logger = new Logger(VideoHandleProviderStatusUseCase.name);

  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
    private readonly eventBus: VideoEventBus,
    private readonly filePurgeService: FilePurgeService,
  ) {}

  // Bunny redelivers a status and repeats FINISHED, so this has to stay idempotent: every branch
  // either re-emits an event whose consumer writes the status it already wrote, or overwrites with
  // the provider's current values.
  async execute(providerId: string, status: number): Promise<Either<Error, boolean>> {
    const statusName = this.getStatusName(status);

    if (!this.isActionable(status)) {
      this.logger.debug(`Video ${providerId} reported ${statusName}, nothing to record`);
      return right(false);
    }

    const video = await this.videoRepository.getOne({ providerId });

    if (video.isLeft()) {
      return left(video.value);
    }

    switch (status) {
      case BunnyStreamStatus.PRESIGNED_UPLOAD_FINISHED:
        return this.onUploaded(video.value, statusName);
      case BunnyStreamStatus.FINISHED:
        return this.onEncoded(video.value, statusName);
      case BunnyStreamStatus.FAILED:
      case BunnyStreamStatus.PRESIGNED_UPLOAD_FAILED:
        return this.onFailed(video.value, statusName);
      default:
        return right(false);
    }
  }

  // "Terminal" is the wrong axis now that status 7 matters: it is actionable but the video is still
  // being encoded. The codes are not ordered by progress either (4 and 9 sit between the ones we
  // act on), so this stays a list rather than a range.
  private isActionable(status: number): boolean {
    return (
      status === BunnyStreamStatus.PRESIGNED_UPLOAD_FINISHED ||
      status === BunnyStreamStatus.FINISHED ||
      status === BunnyStreamStatus.FAILED ||
      status === BunnyStreamStatus.PRESIGNED_UPLOAD_FAILED
    );
  }

  // The bytes landed, but Bunny's encode still has up to ~33 minutes to run, so the backing file
  // moves to UPLOADED rather than READY — and stops looking like a stalled upload to the cleanup cron.
  private async onUploaded(
    video: NestStorage.Video,
    statusName: string,
  ): Promise<Either<Error, boolean>> {
    await this.eventBus.emitUploaded(video);
    this.logger.log(`Video ${video.id} received (${statusName})`);
    return right(true);
  }

  private async onEncoded(
    video: NestStorage.Video,
    statusName: string,
  ): Promise<Either<Error, boolean>> {
    // Metadata before the event: READY is what surfaces the video in the admin, and a READY row
    // showing a zero duration for an hour is worse than one extra round-trip here.
    await this.syncMetadata(video);
    await this.eventBus.emitUploadFinish(video);
    this.logger.log(`Video ${video.id} encoded (${statusName})`);
    return right(true);
  }

  private async onFailed(
    video: NestStorage.Video,
    statusName: string,
  ): Promise<Either<Error, boolean>> {
    // A failed encode leaves a broken object behind at the provider — drop it with the row's
    // upload status, the same way the streaming upload used to on error.
    await Promise.allSettled([
      this.eventBus.emitUploadFail(video),
      this.filePurgeService.purge([{ type: FilePurgeType.VIDEO, providerId: video.providerId }]),
    ]);

    this.logger.warn(`Video ${video.id} failed with provider status ${statusName}`);
    return right(true);
  }

  // Best-effort by design: `VideoSyncWithProviderUseCase` pages Bunny hourly and fills these in
  // anyway, so a provider hiccup must not keep the file row out of READY.
  private async syncMetadata(video: NestStorage.Video): Promise<void> {
    const providerVideo = await this.storageVideoService.getVideo(video.providerId);

    if (providerVideo.isLeft()) {
      this.logger.warn(
        `Failed to read provider metadata for video ${video.id}: ${providerVideo.value.message}`,
      );
      return;
    }

    const updated = await this.videoRepository.updateById(video.id, {
      set: {
        duration: providerVideo.value.duration,
        views: providerVideo.value.views,
      },
    });

    if (updated.isLeft()) {
      this.logger.warn(`Failed to store provider metadata for video ${video.id}`);
    }
  }

  // The number is never dropped: Bunny's list grows, and an unmapped code would otherwise log as
  // `undefined` and lose the only fact we actually received.
  private getStatusName(status: number): string {
    const name = BUNNY_STREAM_STATUS_NAMES[status];
    return name ? `${name} (${status})` : `unknown status ${status}`;
  }
}
