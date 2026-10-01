import { FileEventBus, FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

/**
 * Turns a directly uploaded file READY once the provider holds exactly the declared bytes: the one
 * step behind both `completeUpload` and `completeMany`.
 *
 * Bunny Storage reports nothing back on its own, so the caller confirms after its PUT and the
 * provider is asked (HEAD) rather than believed. Idempotent: a READY file is returned as is, and a
 * repeated call after a lost response lands on the same answer.
 */
@Injectable()
export class FileCompletionService {
  private readonly logger = new Logger(FileCompletionService.name);

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageFileService: StorageFileService,
    private readonly filePurgeService: FilePurgeService,
    private readonly eventBus: FileEventBus,
  ) {}

  async complete(file: NestStorage.File): Promise<Either<Error, NestStorage.File>> {
    const { id, providerId, size, uploadStatus } = file;

    if (uploadStatus === NestStorage.FileUploadStatus.READY) {
      return right(file);
    }

    // A video's file row has no Storage key — its bytes are Bunny Stream's business.
    if (!providerId) {
      return left(new BadRequestException('File is not uploaded to Bunny Storage'));
    }

    const storedSize = await this.storageFileService.getObjectSize(providerId);

    if (storedSize.isLeft()) {
      return left(storedSize.value);
    }

    if (storedSize.value === null) {
      // Nothing to judge yet — the PUT may still be in flight. The row stays as it is, so the
      // caller can retry, and the cleanup cron reclaims it if nobody ever does.
      return left(new ConflictException('File has not been uploaded yet'));
    }

    if (storedSize.value !== size) {
      this.logger.warn(`File ${id}: stored ${storedSize.value} bytes, declared ${size}`);

      await this.fileRepository.updateById(id, {
        set: { uploadStatus: NestStorage.FileUploadStatus.FAILED },
      });
      await this.filePurgeService.purge([{ type: FilePurgeType.FILE, providerId }]);

      return left(new BadRequestException(`Uploaded ${storedSize.value} bytes, expected ${size}`));
    }

    // Conditional on a not-yet-READY status, so two concurrent confirmations cannot both write.
    const updated = await this.fileRepository.updateOne(
      {
        id,
        uploadStatuses: [NestStorage.FileUploadStatus.PENDING, NestStorage.FileUploadStatus.FAILED],
      },
      { set: { uploadStatus: NestStorage.FileUploadStatus.READY } },
    );

    if (updated.isLeft()) {
      return this.fileRepository.getById(id);
    }

    await this.emitReady(updated.value);

    return updated;
  }

  // Only the call that made the file READY announces it. A lost emit leaves an image without a
  // preview until the image module's sweep finds it, so it is logged, never failed: the upload
  // itself did complete.
  private async emitReady(file: NestStorage.File): Promise<void> {
    try {
      await this.eventBus.emitReady(file);
    } catch (error) {
      this.logger.error(`Failed to announce file ${file.id} as READY`, error?.stack);
    }
  }
}
