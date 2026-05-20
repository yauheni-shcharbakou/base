import { NestStorage } from '@backend/proto';

export interface StorageObject extends NestStorage.StorageObject {
  isDeleted: boolean;
}
