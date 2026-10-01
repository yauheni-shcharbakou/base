import { NestStorage } from '@backend/proto';
import { Config } from '@/config';
import { FileDropService } from '@modules/file/application/services/file.drop.service';
import { FileRepository, FileWithMedia } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import _ from 'lodash';
import moment from 'moment';

// Per run and per sweep; what is left over waits for the next run. The purges go through the event
// bus, so the provider sees them at the queue's pace rather than all at once.
const SWEEP_LIMIT = 500;

// Past an upload window, before its PENDING row is called failed. A pre-signed PUT is checked when
// it starts, so its bytes may still be on their way after the window closes, and Bunny's "uploaded"
// callback trails a video's last byte.
export const UPLOAD_GRACE_MINUTES = 60;

@Injectable()
export class FileCleanupUseCase {
  private readonly logger = new Logger(FileCleanupUseCase.name);
  private readonly ttlHours: number;

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly fileDropService: FileDropService,
    private readonly storageFileService: StorageFileService,
    private readonly storageVideoService: StorageVideoService,
    configService: ConfigService<Config>,
  ) {
    this.ttlHours = configService.getOrThrow('pendingFileTtlHours', { infer: true });
  }

  async execute(): Promise<void> {
    await this.failExpiredUploads();
    await this.drop('stale upload', await this.getStaleUploads());
    await this.drop(
      'deleted storage object',
      await this.fileRepository.getManyInDeletedStorageObjects(SWEEP_LIMIT),
    );
  }

  // A row still PENDING once both upload windows have closed cannot get its bytes any more — the
  // tab was closed, the transfer died. FAILED says so, and the admin offers to upload it again,
  // until the stale sweep takes the row. One cutoff for both kinds: the longer window.
  private async failExpiredUploads(): Promise<void> {
    const windowMinutes = Math.max(
      this.storageFileService.uploadWindowMinutes,
      this.storageVideoService.uploadWindowMinutes,
    );
    const failed = await this.fileRepository.failPendingBefore(
      moment()
        .subtract(windowMinutes + UPLOAD_GRACE_MINUTES, 'minutes')
        .toDate(),
    );

    // Logged rather than thrown, so a failed mark does not stop the sweeps.
    if (failed.isLeft()) {
      this.logger.error('Failed to mark expired uploads FAILED', failed.value);
      return;
    }

    if (failed.value) {
      this.logger.log(`Marked ${failed.value} expired upload(s) FAILED`);
    }
  }

  // Uploads that never completed. Anything newer than the TTL may still be uploading to the
  // provider or waiting on its encode — a video only turns READY once Bunny's webhook says so.
  private async getStaleUploads(): Promise<FileWithMedia[]> {
    const files = await this.fileRepository.getMany<FileWithMedia>(
      {
        uploadStatuses: [NestStorage.FileUploadStatus.PENDING, NestStorage.FileUploadStatus.FAILED],
        createdBefore: moment().subtract(this.ttlHours, 'hours').toDate(),
      },
      { populate: ['video'] },
    );

    return _.take(files, SWEEP_LIMIT);
  }

  private async drop(reason: string, files: FileWithMedia[]): Promise<void> {
    if (!files.length) {
      return;
    }

    // Caught here rather than in the scheduler, so a failed sweep does not stop the other one.
    let isDeleted: boolean;

    try {
      isDeleted = await this.fileDropService.drop(files);
    } catch (error) {
      this.logger.error(`Failed to drop ${files.length} file(s): ${reason}`, error);
      return;
    }

    if (!isDeleted) {
      this.logger.warn(`None of ${files.length} file(s) left to drop: ${reason}`);
      return;
    }

    this.logger.log(`Dropped ${files.length} file(s): ${reason}`);
  }
}
