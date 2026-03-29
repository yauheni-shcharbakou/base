import { createFile, createManyFiles } from '@/features/storage/actions';
import { StorageData } from '@/features/storage/types';
import { GrpcFile, GrpcFileCreateRequest } from '@packages/grpc';
import { GrpcFileCreateManyRequest } from '@packages/grpc/src';

type FileManyItem = {
  file: File;
  uploadId: string;
};

export class FileActionClient {
  async createOne(file: File, storage?: StorageData): Promise<GrpcFile> {
    const data: GrpcFileCreateRequest = {
      file: {
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      },
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
    items: FileManyItem[],
    storage?: Omit<StorageData, 'name'>,
  ): Promise<GrpcFile[]> {
    const data: GrpcFileCreateManyRequest = {
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
