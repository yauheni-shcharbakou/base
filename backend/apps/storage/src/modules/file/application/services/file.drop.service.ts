import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { FileRepository, FileWithMedia } from '@modules/file/domain/repositories/file.repository';
import { Injectable } from '@nestjs/common';
import _ from 'lodash';

/**
 * Deletes file rows that were just read and purges what they left at the provider. Shared by the
 * cleanup cron and the deleted-user handler.
 *
 * Deleting the ids just read, rather than re-running the query, keeps the rows and their provider
 * objects in step: what leaves the database is exactly what is purged. The image or video row and
 * the storage-object leaf go with each file row through the FK cascade.
 */
@Injectable()
export class FileDropService {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly filePurgeService: FilePurgeService,
  ) {}

  /**
   * `false` when none of the rows was left: whoever deleted them purged their objects. A failed
   * delete is thrown and deletes nothing — one flush — so nothing is purged either.
   */
  async drop(files: FileWithMedia[]): Promise<boolean> {
    if (!files.length) {
      return false;
    }

    const isDeleted = await this.fileRepository.deleteMany({ ids: _.map(files, 'id') });

    if (isDeleted) {
      await this.filePurgeService.purgeFiles(files);
    }

    return isDeleted;
  }
}
