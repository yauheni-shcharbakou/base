import { type NestStorage } from '@backend/proto';

export interface StorageObjectParentUpdateEvent {
  parent: string;
  update: Partial<Pick<NestStorage.StorageObject, 'folderPath' | 'isPublic'>>;
}
