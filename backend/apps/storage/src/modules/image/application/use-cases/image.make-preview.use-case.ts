import { FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { readToBuffer } from '@modules/image/application/helpers/read-to-buffer';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import {
  IMAGE_PREVIEW_MAX_SIDE,
  ImagePreviewService,
  ImagePreviewUndecodableError,
} from '@modules/image/domain/services/image.preview.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable, Logger } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

/** An original up to this size and within the preview's sides is shown as it is. */
export const LIGHT_ORIGINAL_MAX_BYTES = 256 * 1024;

const SVG = 'image/svg+xml';
const GIF = 'image/gif';

/**
 * Gives a READY image the object a grid shows for it: a small webp beside the original, or the
 * original itself when it is already light. Idempotent — an image that has one is left alone, and
 * the preview key is derived, so a repeated run overwrites the same object.
 *
 * `left` only for what a retry can fix (the provider, the database). An image no retry can help is
 * marked failed and answered `right`, so neither the bus nor the sweep comes back to it.
 */
@Injectable()
export class ImageMakePreviewUseCase {
  private readonly logger = new Logger(ImageMakePreviewUseCase.name);

  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly storageFileService: StorageFileService,
    private readonly imagePreviewService: ImagePreviewService,
    private readonly filePurgeService: FilePurgeService,
  ) {}

  async execute({ fileId }: { fileId: string }): Promise<Either<Error, void>> {
    const image = await this.imageRepository.getOne<NestStorage.ImagePopulated>(
      { file: fileId },
      { populate: ['file'] },
    );

    // A plain file, or an image deleted since — nothing to make.
    if (image.isLeft()) {
      return right(undefined);
    }

    const { id, file, previewProviderId } = image.value;

    if (
      previewProviderId ||
      file.uploadStatus !== NestStorage.FileUploadStatus.READY ||
      !file.providerId
    ) {
      return right(undefined);
    }

    if (file.mimeType === SVG) {
      // A vector scales in the browser; one heavy enough to hurt a grid is not worth rasterizing.
      return file.size <= LIGHT_ORIGINAL_MAX_BYTES
        ? this.record(id, file.providerId, false)
        : this.fail(id, 'an SVG too heavy to show as it is');
    }

    if (this.isLightOriginal(image.value)) {
      return this.record(id, file.providerId, false);
    }

    const stream = await this.storageFileService.getObjectStream(file.providerId);

    if (stream.isLeft()) {
      return left(stream.value);
    }

    if (!stream.value) {
      return this.fail(id, `the original ${file.providerId} is missing`);
    }

    let original: Buffer;

    try {
      original = await readToBuffer(stream.value, file.size);
    } catch (error) {
      stream.value.destroy();
      return left(error as Error);
    }

    const preview = await this.imagePreviewService.render(original);

    if (preview.isLeft()) {
      return preview.value instanceof ImagePreviewUndecodableError
        ? this.fail(id, preview.value.message)
        : left(preview.value);
    }

    const key = this.storageFileService.createPreviewKey(file.providerId);
    const stored = await this.storageFileService.putObject(
      key,
      preview.value.body,
      preview.value.contentType,
    );

    if (stored.isLeft()) {
      return left(stored.value);
    }

    return this.record(id, key, true);
  }

  // A GIF is never shown as it is, however small its sides: its size is in the frames.
  private isLightOriginal({ width, height, file }: NestStorage.ImagePopulated): boolean {
    return (
      file.mimeType !== GIF &&
      file.size <= LIGHT_ORIGINAL_MAX_BYTES &&
      width <= IMAGE_PREVIEW_MAX_SIDE &&
      height <= IMAGE_PREVIEW_MAX_SIDE
    );
  }

  private async record(
    id: string,
    previewProviderId: string,
    isOwnObject: boolean,
  ): Promise<Either<Error, void>> {
    const isSet = await this.imageRepository.setPreview(id, previewProviderId);

    if (isSet.isLeft()) {
      return left(isSet.value);
    }

    // Missed: either a concurrent run set the same derived key first, or the image was deleted
    // while its preview was being made — and the delete purged what it knew of, which was not this.
    if (!isSet.value && isOwnObject && !(await this.imageRepository.isExistsById(id))) {
      await this.filePurgeService.purge([
        { type: FilePurgeType.FILE, providerId: previewProviderId },
      ]);
    }

    return right(undefined);
  }

  private async fail(id: string, reason: string): Promise<Either<Error, void>> {
    this.logger.warn(`Image ${id} gets no preview: ${reason}`);

    const isMarked = await this.imageRepository.markPreviewFailed(id);

    return isMarked.isLeft() ? left(isMarked.value) : right(undefined);
  }
}
