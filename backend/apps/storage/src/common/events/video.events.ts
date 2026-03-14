import { GrpcVideoMetadata } from '@backend/grpc';
import { ProviderIdEvent } from 'common/events/common.events';

export enum VideoEventPattern {
  DELETE_ONE = 'video.delete.one',
  UPDATE_ONE = 'video.update.one',
}

export class VideoDeleteOneEvent extends ProviderIdEvent {}

export class VideoUpdateOneEvent extends ProviderIdEvent {
  constructor(
    public readonly providerId: string,
    public readonly update: Partial<GrpcVideoMetadata>,
  ) {
    super(providerId);
  }
}
