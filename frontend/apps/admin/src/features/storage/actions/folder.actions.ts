'use server';

import { authService } from '@/features/auth/services';
import { storageObjectGrpcRepository } from '@/features/grpc/repositories';
import { ClientStorage } from '@frontend/proto';

export async function getUserFolders(
  request: ClientStorage.StorageObjectGetFolders,
): Promise<ClientStorage.StorageObjectPopulated[]> {
  try {
    const metadata = await authService.getAuthMetadata();
    const list = await storageObjectGrpcRepository.getFolders(request, metadata);
    return list.items;
  } catch (error) {
    return [];
  }
}

export async function isExistsStorageObject(
  query: ClientStorage.StorageObjectQuery,
): Promise<boolean> {
  try {
    const metadata = await authService.getAuthMetadata();
    const result = await storageObjectGrpcRepository.isExists(query, metadata);
    return result.value;
  } catch (error) {
    return false;
  }
}

export async function isExistsFolder(query: ClientStorage.StorageObjectQuery): Promise<boolean> {
  return isExistsStorageObject({ ...query, type: ClientStorage.StorageObjectType.FOLDER });
}
