import { NestStorage } from '@backend/proto';
import { Config } from '@/config';
import { FileDropService } from '@modules/file/application/services/file.drop.service';
import { FileRepository, FileWithMedia } from '@modules/file/domain/repositories/file.repository';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import _ from 'lodash';
import moment from 'moment';

// Per run and per sweep; what is left over waits for the next run. The purges go through the event
// bus, so the provider sees them at the queue's pace rather than all at once.
const SWEEP_LIMIT = 500;

@Injectable()
export class FileCleanupUseCase {
  private readonly logger = new Logger(FileCleanupUseCase.name);
  private readonly ttlHours: number;

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly fileDropService: FileDropService,
    configService: ConfigService<Config>,
  ) {
    this.ttlHours = configService.getOrThrow('pendingFileTtlHours', { infer: true });
  }

  async execute(): Promise<void> {
    await this.drop('stale upload', await this.getStaleUploads());
    await this.drop(
      'deleted storage object',
      await this.fileRepository.getManyInDeletedStorageObjects(SWEEP_LIMIT),
    );
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
