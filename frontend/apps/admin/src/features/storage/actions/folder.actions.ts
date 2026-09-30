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

/** Deletes objects of one owner in one gateway call — all or none, each folder with its subtree. */
export async function deleteStorageObjects(
  ids: string[],
): Promise<ActionResult<ClientStorage.StorageObject[]>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    return (await storageObjectGrpcRepository.deleteByIds({ ids }, metadata)).items;
  });
}

/**
 * Moves objects of one owner into `parent` in one gateway call — all or none. A name taken there
 * comes back suffixed, so the answer is each object under the name it ended up with.
 */
export async function moveStorageObjects(
  ids: string[],
  parent: string,
): Promise<ActionResult<ClientStorage.StorageObject[]>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    return (await storageObjectGrpcRepository.moveByIds({ ids, parent }, metadata)).items;
  });
}

/**
 * Makes a folder of `userId` inside `parent`. It is public in a public folder and private anywhere
 * else; a name taken there is refused with a 409, not suffixed — the caller typed it.
 */
export async function createStorageFolder(
  userId: string,
  parent: string,
  name: string,
): Promise<ActionResult<ClientStorage.StorageObject>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    return storageObjectGrpcRepository.createOne(
      {
        userId,
        parent,
        name,
        isPublic: false,
        type: ClientStorage.StorageObjectType.FOLDER,
      },
      metadata,
    );
  });
}
