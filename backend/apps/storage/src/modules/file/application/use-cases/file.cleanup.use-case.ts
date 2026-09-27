import { NestStorage } from '@backend/proto';
import { Config } from '@/config';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { FileRepository, FileWithVideo } from '@modules/file/domain/repositories/file.repository';
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
    private readonly filePurgeService: FilePurgeService,
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
  private async getStaleUploads(): Promise<FileWithVideo[]> {
    const files = await this.fileRepository.getMany<FileWithVideo>(
      {
        uploadStatuses: [NestStorage.FileUploadStatus.PENDING, NestStorage.FileUploadStatus.FAILED],
        createdBefore: moment().subtract(this.ttlHours, 'hours').toDate(),
      },
      { populate: ['video'] },
    );

    return _.take(files, SWEEP_LIMIT);
  }

  // Deleting the ids just read, rather than re-running the query, keeps the rows and their provider
  // objects in step: what leaves the database here is exactly what is purged. The image or video
  // row and the storage object go with each file row through the FK cascade.
  private async drop(reason: string, files: FileWithVideo[]): Promise<void> {
    if (!files.length) {
      return;
    }

    // Caught here rather than in the scheduler, so a failed sweep does not stop the other one. A
    // failure deletes nothing — one flush — so nothing is purged either.
    let isDeleted: boolean;

    try {
      isDeleted = await this.fileRepository.deleteMany({ ids: _.map(files, 'id') });
    } catch (error) {
      this.logger.error(`Failed to drop ${files.length} file(s): ${reason}`, error);
      return;
    }

    // The rows were gone already: whoever deleted them purged their objects.
    if (!isDeleted) {
      this.logger.warn(`None of ${files.length} file(s) left to drop: ${reason}`);
      return;
    }

    await this.filePurgeService.purgeFiles(files);
    this.logger.log(`Dropped ${files.length} file(s): ${reason}`);
  }
}
