'use server';

import { authService } from '@/features/auth/services';
import { storageObjectGrpcRepository } from '@/features/grpc/repositories';
import { GrpcStorageObjectPopulated, GrpcStorageObjectType } from '@frontend/grpc';

export async function getUserFolders(userId: string): Promise<GrpcStorageObjectPopulated[]> {
  try {
    const metadata = await authService.getAuthMetadata();

    const list = await storageObjectGrpcRepository.getMany(
      { query: { userId, type: GrpcStorageObjectType.FOLDER, ids: [] } },
      metadata,
    );

    return list.items;
  } catch (error) {
    return [];
  }
}
