import { NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageObjectCreateRootFolderUseCase {
  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  async execute(userId: string): Promise<void> {
    const hasRootFolder = await this.storageObjectRepository.isExists({
      userId,
      type: NestStorage.StorageObjectType.FOLDER,
    });

    if (hasRootFolder) {
      return;
    }

    await this.storageObjectRepository.saveOne({
      userId,
      type: NestStorage.StorageObjectType.FOLDER,
      name: '',
      isPublic: false,
      folderPath: '/',
      isFolder: true,
    });
  }
}
