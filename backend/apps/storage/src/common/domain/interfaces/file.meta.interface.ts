import { NestStorage } from '@backend/proto';

export interface FileMeta extends Pick<
  NestStorage.File,
  'originalName' | 'mimeType' | 'size' | 'uploadStatus' | 'extension' | 'providerId'
> {}
