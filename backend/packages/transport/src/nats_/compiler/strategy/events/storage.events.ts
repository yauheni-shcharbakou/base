import { GrpcVideoUpdateSet } from '@backend/grpc';

export interface ProviderIdEvent {
  providerId: string;
}

export interface VideoUpdateOneEvent extends ProviderIdEvent {
  update: GrpcVideoUpdateSet;
}

export interface StorageObjectUpdateIsPublicEvent {
  parent: string;
  isPublic: boolean;
}
