import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { Injectable } from '@nestjs/common';
import _ from 'lodash';
import moment from 'moment';

@Injectable()
export class FileCleanupUseCase {
  constructor(private readonly fileRepository: FileRepository) {}

  async execute() {
    let page = 1;
    let hasNext = true;
    const createdAfter = moment().subtract(1, 'hour').toDate();

    do {
      const { items, total } = await this.fileRepository.getList({
        query: {
          uploadStatuses: [
            NestStorage.FileUploadStatus.PENDING,
            NestStorage.FileUploadStatus.FAILED,
          ],
          createdAfter,
        },
        pagination: {
          page,
          limit: 100,
        },
      });

      if (items.length) {
        const ids = _.map(items, 'id');
        await this.fileRepository.deleteMany({ ids });
      }

      hasNext = page * 100 < total;
      page += 1;
    } while (hasNext);
  }
}
