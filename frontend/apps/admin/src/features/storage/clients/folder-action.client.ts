import { getUserFolders, isExistsFolder } from '@/features/storage/actions';
import { GrpcStorageObjectExistsFolderRequest, GrpcStorageObjectPopulated } from '@packages/grpc';

export class FolderActionClient {
  async isExistsFolder(request: GrpcStorageObjectExistsFolderRequest): Promise<boolean> {
    return isExistsFolder(request);
  }

  async getUserFolders(): Promise<GrpcStorageObjectPopulated[]> {
    return getUserFolders();
  }
}
