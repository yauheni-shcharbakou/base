import { NestStorage } from '@backend/proto';
import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { StorageVideo } from '../entities/storage.video.interface';

export abstract class StorageVideoService {
  abstract createVideo(
    data: StorageVideoCreateData,
  ):
    | Either<InternalServerErrorException, string>
    | Promise<Either<InternalServerErrorException, string>>;
  abstract getTusUpload(
    providerId: string,
    data: StorageVideoTusUploadData,
  ): Either<Error, NestStorage.VideoTusUpload>;
  abstract deleteVideo(providerId: string): Promise<Either<InternalServerErrorException, boolean>>;
  abstract updateVideo(
    providerId: string,
    updateData: NestStorage.VideoUpdateSet,
  ): Promise<Either<Error, boolean>>;
  /**
   * One video's metadata straight from the provider. Either-typed where `getList` is not: the sync
   * cron cannot act on a failed page and swallows it, but a caller reconciling a single video has
   * to tell "the provider reports 0 views" apart from "the provider did not answer".
   */
  abstract getVideo(providerId: string): Promise<Either<Error, StorageVideo>>;
  abstract getList(page: number, limit: number): Promise<StorageVideoList>;
  abstract getPlayerUrl(providerId: string): Either<Error, string> | Promise<Either<Error, string>>;
  /** A signed URL of the video's thumbnail image, built without a call to the provider. */
  abstract getThumbnailUrl(providerId: string): Either<Error, string>;
  abstract getDownloadUrl(
    providerId: string,
  ): Either<Error, string> | Promise<Either<Error, string>>;
}

export interface StorageVideoCreateData extends NestStorage.VideoCreate {
  userId: string;
}

export interface StorageVideoTusUploadData {
  title: string;
  mimeType: string;
}

export interface StorageVideoList {
  total: number;
  items: StorageVideo[];
}
