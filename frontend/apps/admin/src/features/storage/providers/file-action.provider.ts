import { createFile, createManyFiles } from '@/features/storage/actions';
import { StorageData, StorageUploadItem } from '@/features/storage/types';
import type { BrowserStorage } from '@packages/proto';

export class FileActionProvider {
  async createOne(userId: string, file: File, storage?: StorageData): Promise<BrowserStorage.File> {
    const data: BrowserStorage.FileCreateOne = {
      file: {
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      },
      userId,
    };

    if (storage?.parent) {
      data.storage = {
        parent: storage.parent,
        name: storage.name || file.name,
        isPublic: storage.isPublic ?? false,
      };
    }

    const response = await createFile(data);

    if ('error' in response) {
      throw new Error(response.error);
    }

    return response.entity;
  }

  async createMany(
    userId: string,
    items: StorageUploadItem[],
    storage?: Omit<StorageData, 'name'>,
  ): Promise<BrowserStorage.File[]> {
    const data: BrowserStorage.FileCreateMany = {
      items: items.map((item) => {
        return {
          file: {
            originalName: item.file.name,
            size: item.file.size,
            mimeType: item.file.type,
          },
          uploadId: item.uploadId,
        };
      }),
      userId,
    };

    if (storage?.parent) {
      data.storage = {
        parent: storage.parent,
        isPublic: storage.isPublic ?? false,
      };
    }

    const response = await createManyFiles(data);

    if ('error' in response) {
      throw new Error(response.error);
    }

    return response.data;
  }
}
