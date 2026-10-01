import { Config } from '@/config';
import { ImageMakePreviewUseCase } from '@modules/image/application/use-cases/image.make-preview.use-case';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import moment from 'moment';

/**
 * Makes the previews the READY event did not: a lost emit, a handler that ran out of retries, and
 * every image uploaded before previews existed. Sequential, so at most one original is in memory.
 */
@Injectable()
export class ImageSweepPreviewsUseCase {
  private readonly logger = new Logger(ImageSweepPreviewsUseCase.name);
  /** Images one sweep takes on — `STORAGE_IMAGE_PREVIEW_SWEEP_LIMIT`. */
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

  async execute(): Promise<void> {
    const images = await this.imageRepository.getManyWithoutPreview(
      moment().subtract(this.graceMinutes, 'minutes').toDate(),
      this.limit,
    );

    for (const image of images) {
      const result = await this.makePreviewUseCase.execute({ fileId: image.fileId });

      if (result.isLeft()) {
        this.logger.warn(`Image ${image.id}: no preview this sweep: ${result.value.message}`);
      }
    }
  }
}
