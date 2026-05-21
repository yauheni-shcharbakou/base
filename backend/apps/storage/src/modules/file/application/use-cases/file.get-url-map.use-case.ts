import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable } from '@nestjs/common';
import _ from 'lodash';

@Injectable()
export class FileGetUrlMapUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageFileService: StorageFileService,
  ) {}

  async execute(query: Partial<NestStorage.FileQuery>, ip?: string): Promise<Map<string, string>> {
    const files = await this.fileRepository.getMany(query);
    const urlMap = new Map<string, string>();

    await Promise.all(
      _.map(files, async (file) => {
        if (!file.providerId) {
          return;
        }

        const url = await this.storageFileService.getFileSignedUrl(file.providerId, ip);

        if (url.isRight()) {
          urlMap.set(file.id, url.value);
        }
      }),
    );

    return urlMap;
  }
}
