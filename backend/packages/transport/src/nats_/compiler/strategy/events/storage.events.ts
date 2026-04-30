import type { NestStorage } from '@backend/proto';

export interface ProviderIdEvent {
  providerId: string;
}

export interface VideoUpdateOneEvent extends ProviderIdEvent {
  update: NestStorage.VideoUpdateSet;
}

export interface StorageObjectUpdateParentEvent {
  parent: string;
  update: Partial<Pick<NestStorage.StorageObject, 'folderPath' | 'isPublic'>>;
}
