import { NestStorage } from '@backend/proto';

export interface StorageVideo extends Pick<
  NestStorage.Video,
  'providerId' | 'duration' | 'views'
> {}
