import { NestStorage } from '@backend/proto';
import { Config } from '@/config';
import { PreviewSweepUseCase } from '@common/application/use-cases/preview.sweep.use-case';
import { ImageMakePreviewUseCase } from '@modules/image/application/use-cases/image.make-preview.use-case';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Either } from '@sweet-monads/either';

/** The preview sweep over images, tuned by `STORAGE_IMAGE_PREVIEW_SWEEP_*`. */
@Injectable()
export class ImageSweepPreviewsUseCase extends PreviewSweepUseCase<NestStorage.ImagePopulated> {
  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly makePreviewUseCase: ImageMakePreviewUseCase,
    configService: ConfigService<Config>,
  ) {
    super('Image', configService.getOrThrow('imagePreviewSweep', { infer: true }));
  }

  protected getRows(
    readyBefore: Date,
    limit: number,
    afterId?: string,
  ): Promise<NestStorage.ImagePopulated[]> {
    return this.imageRepository.getManyWithoutPreview(readyBefore, limit, afterId);
  }

  protected makePreview(image: NestStorage.ImagePopulated): Promise<Either<Error, boolean>> {
    return this.makePreviewUseCase.execute({ fileId: image.fileId });
  }

  protected countPreviewAttempt(id: string, maxAttempts: number): Promise<Either<Error, boolean>> {
    return this.imageRepository.countPreviewAttempt(id, maxAttempts);
  }
}
