'use server';

import { authService } from '@/features/auth/services';
import { storageObjectGrpcRepository } from '@/features/grpc/repositories';
import {
  GrpcStorageObjectExistsFolderRequest,
  GrpcStorageObjectGetFoldersItem,
  GrpcStorageObjectGetFoldersRequest,
} from '@frontend/grpc';

export async function getUserFolders(
  request: GrpcStorageObjectGetFoldersRequest,
): Promise<GrpcStorageObjectGetFoldersItem[]> {
  try {
    const metadata = await authService.getAuthMetadata();
    const list = await storageObjectGrpcRepository.getFolders(request, metadata);
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
