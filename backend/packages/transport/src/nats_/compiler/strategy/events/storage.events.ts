import { GrpcVideoMetadata } from '@backend/grpc';

export interface ProviderIdEvent {
  providerId: string;
}

export interface VideoUpdateOneEvent extends ProviderIdEvent {
  update: Partial<GrpcVideoMetadata>;
}

export interface StorageObjectUpdateIsPublicEvent {
  parent: string;
  isPublic: boolean;
}
