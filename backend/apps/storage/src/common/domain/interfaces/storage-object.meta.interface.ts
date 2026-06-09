import { CreateOf } from '@backend/common';
import { NestStorage } from '@backend/proto';

export interface StorageObjectFileMeta extends Pick<
  CreateOf<NestStorage.StorageMeta>,
  'name' | 'isPublic'
> {
  parent?: string;
}
