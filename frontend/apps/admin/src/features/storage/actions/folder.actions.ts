'use server';

import { authService } from '@/features/auth/services';
import { runAction } from '@/features/grpc/helpers/run-action';
import { storageObjectGrpcRepository } from '@/features/grpc/repositories';
import type { ActionResult } from '@/features/grpc/types';
import type { FolderContentRequest } from '@/features/storage/types';
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

/**
 * A page of one folder. A deep link knows only the folder, so its owner is read first; the browser
 * passes the owner it already knows from an earlier listing and saves that call.
 */
export async function getFolderContent({
  folderId,
  userId,
  sortBy,
  sortOrder,
  page,
  pageSize,
  search,
  types,
}: FolderContentRequest): Promise<ActionResult<ClientStorage.StorageObjectFolderContent>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    const ownerId =
      userId ?? (await storageObjectGrpcRepository.getById({ id: folderId }, metadata)).userId;

    return storageObjectGrpcRepository.getFolderContent(
      {
        parentId: folderId,
        userId: ownerId,
        query: { search: search?.trim() || undefined, types },
        sorters: [{ field: sortBy, order: sortOrder }],
        pagination: { page, limit: pageSize },
      },
      metadata,
    );
  });
}

export async function getRootFolder(
  userId: string,
): Promise<ActionResult<ClientStorage.StorageObject>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    return storageObjectGrpcRepository.getRootFolder({ userId }, metadata);
  });
}
