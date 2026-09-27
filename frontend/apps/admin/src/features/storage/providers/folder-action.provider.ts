import { getUserFolders, isExistsFolder, isExistsStorageObject } from '@/features/storage/actions';
import type { BrowserStorage } from '@packages/proto';

export class FolderActionProvider {
  async isExistsFolder(query: BrowserStorage.StorageObjectQuery): Promise<boolean> {
    return isExistsFolder(query);
  }

  /**
   * The backend's rule for a rename or a move, checked ahead so the form can show it on the field:
   * a folder's name is taken by another folder, a file's by any object in the same folder.
   */
  async isNameTaken({
    isFolder,
    ...query
  }: BrowserStorage.StorageObjectQuery & { isFolder: boolean }): Promise<boolean> {
    return isFolder ? isExistsFolder(query) : isExistsStorageObject(query);
  }

  async getUserFolders(
    userId: string,
    excludeChildrenOf?: string,
  ): Promise<BrowserStorage.StorageObjectPopulated[]> {
    return getUserFolders({ userId, excludeChildrenOf });
  }
}
