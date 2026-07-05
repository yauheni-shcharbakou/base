import { getUserFolders, isExistsFolder } from '@/features/storage/actions';
import type { BrowserStorage } from '@packages/proto';

export class FolderActionProvider {
  async isExistsFolder(query: BrowserStorage.StorageObjectQuery): Promise<boolean> {
    return isExistsFolder(query);
  }

  async getUserFolders(
    userId: string,
    excludeChildrenOf?: string,
  ): Promise<BrowserStorage.StorageObjectPopulated[]> {
    return getUserFolders({ userId, excludeChildrenOf });
  }
}
