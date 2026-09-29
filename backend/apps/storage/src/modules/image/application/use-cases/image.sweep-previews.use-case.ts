import { ImageMakePreviewUseCase } from '@modules/image/application/use-cases/image.make-preview.use-case';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { Injectable, Logger } from '@nestjs/common';
import moment from 'moment';

/** Images one sweep takes on — each is a download of up to 100 MB, one after another. */
const SWEEP_LIMIT = 20;

/**
 * An image READY for this long without a preview was missed by the READY event — the emit is
 * logged, never retried — so the sweep does not race a handler that is still at work.
 */
const GRACE_MINUTES = 10;

/**
 * Makes the previews the READY event did not: a lost emit, a handler that ran out of retries, and
 * every image uploaded before previews existed. Sequential, so at most one original is in memory.
 */
@Injectable()
export class ImageSweepPreviewsUseCase {
  private readonly logger = new Logger(ImageSweepPreviewsUseCase.name);

  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly makePreviewUseCase: ImageMakePreviewUseCase,
  ) {}

  async execute(): Promise<void> {
    const images = await this.imageRepository.getManyWithoutPreview(
      moment().subtract(GRACE_MINUTES, 'minutes').toDate(),
      SWEEP_LIMIT,
    );

    for (const image of images) {
      const result = await this.makePreviewUseCase.execute({ fileId: image.fileId });

      if (result.isLeft()) {
        this.logger.warn(`Image ${image.id}: no preview this sweep: ${result.value.message}`);
      }
    }
  }
}
