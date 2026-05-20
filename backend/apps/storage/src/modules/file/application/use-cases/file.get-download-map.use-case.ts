import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable } from '@nestjs/common';
import _ from 'lodash';

@Injectable()
export class FileGetDownloadMapUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageFileService: StorageFileService,
  ) {}

  async execute(request: NestStorage.GetUrlMap): Promise<NestStorage.DownloadMap> {
    const files = await this.fileRepository.getMany(_.omit(request, ['ip']));
    const items: NestStorage.DownloadMap['items'] = {};

    await Promise.all(
      _.map(files, async (file) => {
        if (!file.providerId) {
          return;
        }

        const url = await this.storageFileService.getFileSignedUrl(file.providerId, request.ip);

        if (url.isRight()) {
          items[file.id] = {
            url: url.value,
            fileName: `${file.id}.${file.extension}`,
          };
        }
      }),
    );

    return { items };
  }
}
