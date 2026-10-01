import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import {
  createStorageFolder,
  createStorageFolders,
  deleteStorageObjects,
  getFolderContent,
  getRootFolder,
  getUserFolders,
  moveStorageObjects,
  renameStorageObject,
  setStorageObjectsPublic,
} from '@/features/storage/actions';
import type { FolderContentRequest } from '@/features/storage/types';
import type { BrowserStorage } from '@packages/proto';

export class FolderActionProvider {
  async getUserFolders(userId: string): Promise<BrowserStorage.StorageObjectPopulated[]> {
    return getUserFolders({ userId });
  }

  async getFolderContent(
    request: FolderContentRequest,
  ): Promise<BrowserStorage.StorageObjectFolderContent> {
    return unwrapActionResult(await getFolderContent(request));
  }

  async getRootFolder(userId: string): Promise<BrowserStorage.StorageObject> {
    return unwrapActionResult(await getRootFolder(userId));
  }

  async deleteMany(ids: string[]): Promise<BrowserStorage.StorageObject[]> {
    return unwrapActionResult(await deleteStorageObjects(ids));
  }

  async moveMany(ids: string[], parent: string): Promise<BrowserStorage.StorageObject[]> {
    return unwrapActionResult(await moveStorageObjects(ids, parent));
  }

  async createFolder(
    userId: string,
    parent: string,
    name: string,
  ): Promise<BrowserStorage.StorageObject> {
    return unwrapActionResult(await createStorageFolder(userId, parent, name));
  }

  async createFolders(
    userId: string,
    parent: string,
    paths: string[],
  ): Promise<BrowserStorage.StorageObject[]> {
    return unwrapActionResult(await createStorageFolders(userId, parent, paths));
  }

  async rename(id: string, name: string): Promise<BrowserStorage.StorageObject> {
    return unwrapActionResult(await renameStorageObject(id, name));
  }

  async setPublic(ids: string[], isPublic: boolean): Promise<BrowserStorage.StorageObject[]> {
    return unwrapActionResult(await setStorageObjectsPublic(ids, isPublic));
  }
}
