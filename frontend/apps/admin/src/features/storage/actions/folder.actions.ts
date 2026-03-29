'use server';

import { authService } from '@/features/auth/services';
import { storageObjectGrpcRepository } from '@/features/grpc/repositories';
import {
  GrpcStorageObjectExistsFolderRequest,
  GrpcStorageObjectPopulated,
  GrpcStorageObjectType,
} from '@frontend/grpc';

export async function getUserFolders(): Promise<GrpcStorageObjectPopulated[]> {
  try {
    const metadata = await authService.getAuthMetadata();
    const userId = await authService.getCurrentUserId();

    const list = await storageObjectGrpcRepository.getMany(
      { query: { userId, type: GrpcStorageObjectType.FOLDER, ids: [] } },
      metadata,
    );

    return list.items;
  } catch (error) {
    return [];
  }
}

export async function isExistsFolder(
  request: GrpcStorageObjectExistsFolderRequest,
): Promise<boolean> {
  try {
    const metadata = await authService.getAuthMetadata();
    const result = await storageObjectGrpcRepository.isExistsFolder(request, metadata);
    return result.value;
  } catch (error) {
    return false;
  }
}
