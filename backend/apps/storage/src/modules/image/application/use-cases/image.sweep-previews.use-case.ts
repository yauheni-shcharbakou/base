import { Config } from '@/config';
import { ImageMakePreviewUseCase } from '@modules/image/application/use-cases/image.make-preview.use-case';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import moment from 'moment';

/**
 * Makes the previews the READY event did not: a lost emit, a handler that ran out of retries, and
 * every image uploaded before previews existed. Sequential, so at most one original is in memory.
 *
 * One call is one batch. The scheduler calls again with the id this one answered, for as long as
 * its budget lasts (ADR-0037).
 */
@Injectable()
export class ImageSweepPreviewsUseCase {
  private readonly logger = new Logger(ImageSweepPreviewsUseCase.name);
  /** Images one batch takes on — `STORAGE_IMAGE_PREVIEW_SWEEP_LIMIT`. */
  private readonly limit: number;
  /**
   * An image READY for this long without a preview was missed by the READY event — the emit is
   * logged, never retried — so the sweep does not race a handler that is still at work.
   */
  private readonly graceMinutes: number;
  /** Sweeps an image may fail before it is given up on; 0 never gives up. */
  private readonly maxAttempts: number;

  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly makePreviewUseCase: ImageMakePreviewUseCase,
    configService: ConfigService<Config>,
  ) {
    const sweep = configService.getOrThrow('imagePreviewSweep', { infer: true });

    this.limit = sweep.limit;
    this.graceMinutes = sweep.graceMinutes;
    this.maxAttempts = sweep.maxAttempts;
  }

  /**
   * Answers the id to go on from, or nothing once the backlog ended in this batch. The next batch
   * starts past it whatever became of these images, so one that keeps failing holds nothing back —
   * the next sweep starts over and comes to it again.
   */
  async execute(afterId?: string): Promise<string | undefined> {
    const images = await this.imageRepository.getManyWithoutPreview(
      moment().subtract(this.graceMinutes, 'minutes').toDate(),
      this.limit,
      afterId,
    );

    for (const image of images) {
      const result = await this.makePreviewUseCase.execute({ fileId: image.fileId });

      if (result.isLeft()) {
        this.logger.warn(`Image ${image.id}: no preview this sweep: ${result.value.message}`);
        await this.countAttempt(image.id);
      }
    }

    return images.length === this.limit ? images[images.length - 1].id : undefined;
  }

  // A `left` is a failure a retry might fix, but the sweep cannot tell one that never will — an
  // original whose stream breaks every time — and would download it again every sweep, for good.
  // Counted here and not in the use case it calls: the event handler's retries are BullMQ's.
  private async countAttempt(id: string): Promise<void> {
    if (!this.maxAttempts) {
      return;
    }

    const gaveUp = await this.imageRepository.countPreviewAttempt(id, this.maxAttempts);

    if (gaveUp.isLeft()) {
      this.logger.error(`Image ${id}: failed to count the attempt`, gaveUp.value);
      return;
    }

    if (gaveUp.value) {
      this.logger.warn(
        `Image ${id}: given up on after ${this.maxAttempts} sweeps without a preview`,
      );
    }
  }
}
