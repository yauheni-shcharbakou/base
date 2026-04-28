import { getUserFolders, isExistsFolder } from '@/features/storage/actions';
import type { BrowserStorage } from '@packages/proto';

export class FolderActionProvider {
  async isExistsFolder(request: BrowserStorage.StorageObjectExistsFolderRequest): Promise<boolean> {
    return isExistsFolder(request);
  }

  async getUserFolders(id?: string): Promise<BrowserStorage.StorageObjectGetFoldersItem[]> {
    return getUserFolders({ id });
  }
}
