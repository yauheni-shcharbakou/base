import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

/**
 * Turns a directly uploaded file READY once the provider holds exactly the declared bytes.
 *
 * Bunny Storage reports nothing back on its own, so the caller confirms after its PUT and the
 * provider is asked (HEAD) rather than believed. Idempotent: a READY file is returned as is, and a
 * repeated call after a lost response lands on the same answer.
 */
@Injectable()
export class FileCompleteUploadUseCase {
  private readonly logger = new Logger(FileCompleteUploadUseCase.name);

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageFileService: StorageFileService,
  ) {}

  async execute({
    id,
    userId,
  }: NestStorage.FileCompleteUpload): Promise<Either<Error, NestStorage.File>> {
    const file = await this.fileRepository.getOne({ id, userId });

    if (file.isLeft()) {
      return left(file.value);
    }

    const { providerId, size, uploadStatus } = file.value;

    if (uploadStatus === NestStorage.FileUploadStatus.READY) {
      return right(file.value);
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
      await this.storageFileService.deleteFile(providerId);

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

    return updated.isRight() ? updated : this.fileRepository.getById(id);
  }
}
