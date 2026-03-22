'use client';

import {
  createFile,
  createImage,
  createStorageObject,
  createVideo,
  getUserFolders,
  isExistsFolder,
} from '@/features/file/actions';
import {
  GrpcFile,
  GrpcFileCreate,
  GrpcImage,
  GrpcImageCreateRequest,
  GrpcStorageObjectCreate,
  GrpcVideo,
  GrpcVideoCreateRequest,
  GrpcStorageObjectType,
  GrpcStorageObjectExistsFolderRequest,
  GrpcStorageObjectPopulated,
} from '@packages/grpc';

type StorageData = Partial<Pick<GrpcStorageObjectCreate, 'parent' | 'isPublic' | 'name'>>;

export class StorageActionClient {
  async createFile(file: GrpcFileCreate, storage?: StorageData): Promise<GrpcFile> {
    const response = await createFile(file);

    if ('error' in response) {
      throw new Error(response.error);
    }

    if (storage?.parent) {
      const storageResponse = await createStorageObject({
        parent: storage.parent,
        name: storage.name || file.originalName,
        isPublic: storage.isPublic ?? false,
        type: GrpcStorageObjectType.FILE,
        file: response.entity.id,
      });

      if ('error' in storageResponse) {
        throw new Error(storageResponse.error);
      }
    }

    return response.entity;
  }

  async createVideo(request: GrpcVideoCreateRequest, storage?: StorageData): Promise<GrpcVideo> {
    const response = await createVideo(request);

    if ('error' in response) {
      throw new Error(response.error);
    }

    if (storage?.parent) {
      const storageResponse = await createStorageObject({
        parent: storage.parent,
        name: storage.name || request.file.originalName,
        isPublic: storage.isPublic ?? false,
        type: GrpcStorageObjectType.VIDEO,
        file: response.entity.fileId,
        video: response.entity.id,
      });

      if ('error' in storageResponse) {
        throw new Error(storageResponse.error);
      }
    }

    return response.entity;
  }

  async createImage(request: GrpcImageCreateRequest, storage?: StorageData): Promise<GrpcImage> {
    const response = await createImage(request);

    if ('error' in response) {
      throw new Error(response.error);
    }

    if (storage?.parent) {
      const storageResponse = await createStorageObject({
        parent: storage.parent,
        name: storage.name || request.file.originalName,
        isPublic: storage.isPublic ?? false,
        type: GrpcStorageObjectType.IMAGE,
        file: response.entity.fileId,
        image: response.entity.id,
      });

      if ('error' in storageResponse) {
        throw new Error(storageResponse.error);
      }
    }

    return response.entity;
  }

  async isExistsFolder(request: GrpcStorageObjectExistsFolderRequest): Promise<boolean> {
    return isExistsFolder(request);
  }

  async getUserFolders(): Promise<GrpcStorageObjectPopulated[]> {
    return getUserFolders();
  }
}
