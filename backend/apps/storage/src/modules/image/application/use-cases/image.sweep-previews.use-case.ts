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

  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly makePreviewUseCase: ImageMakePreviewUseCase,
    configService: ConfigService<Config>,
  ) {
    const sweep = configService.getOrThrow('imagePreviewSweep', { infer: true });

    this.limit = sweep.limit;
    this.graceMinutes = sweep.graceMinutes;
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
      }
    }

    return images.length === this.limit ? images[images.length - 1].id : undefined;
  }
}
