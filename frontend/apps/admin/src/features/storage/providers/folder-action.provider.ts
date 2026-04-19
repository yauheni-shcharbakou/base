import { getUserFolders, isExistsFolder } from '@/features/storage/actions';
import {
  GrpcStorageObjectExistsFolderRequest,
  GrpcStorageObjectGetFoldersItem,
} from '@packages/grpc';

export class FolderActionProvider {
  async isExistsFolder(request: GrpcStorageObjectExistsFolderRequest): Promise<boolean> {
    return isExistsFolder(request);
  }

  async getUserFolders(id?: string): Promise<GrpcStorageObjectGetFoldersItem[]> {
    return getUserFolders({ id });
  }
}
