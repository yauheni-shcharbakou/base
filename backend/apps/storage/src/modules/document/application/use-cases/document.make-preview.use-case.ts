import { FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { readToBuffer } from '@common/application/helpers/read-to-buffer';
import {
  DocumentPreviewService,
  DocumentPreviewUndecodableError,
} from '@modules/document/domain/services/document.preview.service';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable, Logger } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

/** The documents a first-page preview is made for. */
export const PREVIEWABLE_DOCUMENT_TYPES = ['application/pdf'];

/**
 * A heavier document is never drawn: it is read whole into memory, and pdf.js's own structures come
 * on top — the service's memory limit has to hold both (ADR-0032).
 */
export const DOCUMENT_PREVIEW_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Gives a READY PDF the object a grid shows for it: its first page as a small webp beside the
 * original. Idempotent — a file that has one is left alone, and the preview key is derived, so a
 * repeated run overwrites the same object.
 *
 * `left` only for what a retry can fix (the provider, the database, the renderer itself). A document
 * no retry can help is marked failed and answered `right`, so neither the bus nor the sweep comes
 * back to it.
 *
 * A `right` tells whether the provider answered on the way — the original read, or found missing.
 * A document too heavy to draw never asks it, and the sweep's breaker must not take one for a sign
 * that the provider is up.
 */
@Injectable()
export class DocumentMakePreviewUseCase {
  private readonly logger = new Logger(DocumentMakePreviewUseCase.name);

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageFileService: StorageFileService,
    private readonly documentPreviewService: DocumentPreviewService,
    private readonly filePurgeService: FilePurgeService,
  ) {}

  async execute({ fileId }: { fileId: string }): Promise<Either<Error, boolean>> {
    const found = await this.fileRepository.getById(fileId);

    // Deleted since — nothing to make.
    if (found.isLeft()) {
      return right(false);
    }

    const file = found.value;

    if (
      !PREVIEWABLE_DOCUMENT_TYPES.includes(file.mimeType) ||
      file.previewProviderId ||
      file.uploadStatus !== NestStorage.FileUploadStatus.READY ||
      !file.providerId
    ) {
      return right(false);
    }

    if (file.size > DOCUMENT_PREVIEW_MAX_BYTES) {
      return this.fail(file.id, `a document of ${file.size} bytes, too heavy to draw`, false);
    }

    const stream = await this.storageFileService.getObjectStream(file.providerId);

    if (stream.isLeft()) {
      return left(stream.value);
    }

    if (!stream.value) {
      return this.fail(file.id, `the original ${file.providerId} is missing`, true);
    }

    let original: Buffer;

    try {
      original = await readToBuffer(stream.value, file.size);
    } catch (error) {
      stream.value.destroy();
      return left(error as Error);
    }

    const preview = await this.documentPreviewService.render(original);

    if (preview.isLeft()) {
      return preview.value instanceof DocumentPreviewUndecodableError
        ? this.fail(file.id, preview.value.message, true)
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

    return this.record(file.id, key);
  }

  private async record(id: string, previewProviderId: string): Promise<Either<Error, boolean>> {
    const isSet = await this.fileRepository.setPreview(id, previewProviderId);

    if (isSet.isLeft()) {
      return left(isSet.value);
    }

    // Missed: either a concurrent run set the same derived key first, or the file was deleted while
    // its preview was being made — and the delete purged what it knew of, which was not this.
    if (!isSet.value && !(await this.fileRepository.isExistsById(id))) {
      await this.filePurgeService.purge([
        { type: FilePurgeType.FILE, providerId: previewProviderId },
      ]);
    }

    return right(true);
  }

  private async fail(
    id: string,
    reason: string,
    isProviderAnswer: boolean,
  ): Promise<Either<Error, boolean>> {
    this.logger.warn(`File ${id} gets no preview: ${reason}`);

    const isMarked = await this.fileRepository.markPreviewFailed(id);

    return isMarked.isLeft() ? left(isMarked.value) : right(isProviderAnswer);
  }
}
