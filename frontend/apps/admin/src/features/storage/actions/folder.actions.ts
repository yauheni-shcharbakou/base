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
