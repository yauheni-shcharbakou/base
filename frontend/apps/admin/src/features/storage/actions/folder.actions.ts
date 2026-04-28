'use server';

import { authService } from '@/features/auth/services';
import { storageObjectGrpcRepository } from '@/features/grpc/repositories';
import type { ClientStorage } from '@frontend/proto';

export async function getUserFolders(
  request: ClientStorage.StorageObjectGetFoldersRequest,
): Promise<ClientStorage.StorageObjectGetFoldersItem[]> {
  try {
    const metadata = await authService.getAuthMetadata();
    const list = await storageObjectGrpcRepository.getFolders(request, metadata);
    return list.items;
  } catch (error) {
    return [];
  }
}

export async function isExistsFolder(
  request: ClientStorage.StorageObjectExistsFolderRequest,
): Promise<boolean> {
  try {
    const metadata = await authService.getAuthMetadata();
    const result = await storageObjectGrpcRepository.isExistsFolder(request, metadata);
    return result.value;
  } catch (error) {
    return false;
  }
}
