import { NestStorage } from '@backend/proto';

export interface StorageVideo extends Pick<NestStorage.Video, 'providerId' | 'duration' | 'views'> {
  // The provider's own processing status, not our `FileUploadStatus` and not the `Status` the
  // webhook carries — all three number things differently.
  status: number;
}
