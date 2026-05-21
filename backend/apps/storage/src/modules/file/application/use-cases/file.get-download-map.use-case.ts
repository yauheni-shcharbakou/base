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

  async execute(
    query: Partial<NestStorage.FileQuery>,
    ip?: string,
  ): Promise<Map<string, NestStorage.DownloadData>> {
    const files = await this.fileRepository.getMany(query);
    const urlMap = new Map<string, NestStorage.DownloadData>();

    await Promise.all(
      _.map(files, async (file) => {
        if (!file.providerId) {
          return;
        }

        const url = await this.storageFileService.getFileSignedUrl(file.providerId, ip);

        if (url.isRight()) {
          urlMap.set(file.id, {
            url: url.value,
            fileName: `${file.id}.${file.extension}`,
          });
        }
      }),
    );

    return urlMap;
  }
}
