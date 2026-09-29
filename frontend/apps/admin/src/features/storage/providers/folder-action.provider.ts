import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import { getFolderContent, getRootFolder, getUserFolders } from '@/features/storage/actions';
import type { FolderContentRequest } from '@/features/storage/types';
import type { BrowserStorage } from '@packages/proto';

export class FolderActionProvider {
  async getUserFolders(
    userId: string,
    excludeChildrenOf?: string,
  ): Promise<BrowserStorage.StorageObjectPopulated[]> {
    return getUserFolders({ userId, excludeChildrenOf });
  }

  async getFolderContent(
    request: FolderContentRequest,
  ): Promise<BrowserStorage.StorageObjectFolderContent> {
    return unwrapActionResult(await getFolderContent(request));
  }

  async getRootFolder(userId: string): Promise<BrowserStorage.StorageObject> {
    return unwrapActionResult(await getRootFolder(userId));
  }
}
