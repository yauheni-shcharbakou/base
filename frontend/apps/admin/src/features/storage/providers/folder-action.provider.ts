import { getUserFolders } from '@/features/storage/actions';
import type { BrowserStorage } from '@packages/proto';

export class FolderActionProvider {
  async getUserFolders(
    userId: string,
    excludeChildrenOf?: string,
  ): Promise<BrowserStorage.StorageObjectPopulated[]> {
    return getUserFolders({ userId, excludeChildrenOf });
  }
}
