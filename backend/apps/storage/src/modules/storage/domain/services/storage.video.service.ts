import { NestStorage } from '@backend/proto';
import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { PassThrough } from 'node:stream';
import { StorageVideo } from '../entities/storage.video.interface';

export abstract class StorageVideoService {
  abstract createVideo(
    data: StorageVideoCreateData,
  ):
    | Either<InternalServerErrorException, string>
    | Promise<Either<InternalServerErrorException, string>>;
  abstract uploadVideo(
    providerId: string,
    fileSize: number,
    upload$: PassThrough,
  ): Promise<boolean>;
  abstract deleteVideo(providerId: string): Promise<Either<InternalServerErrorException, boolean>>;
  abstract updateVideo(
    providerId: string,
    updateData: NestStorage.VideoUpdateSet,
  ): Promise<Either<Error, boolean>>;
  abstract getList(page: number, limit: number): Promise<StorageVideoList>;
  abstract getPlayerUrl(
    providerId: string,
    ip?: string,
  ): Either<Error, string> | Promise<Either<Error, string>>;
  abstract getDownloadUrl(
    providerId: string,
    ip?: string,
  ): Either<Error, string> | Promise<Either<Error, string>>;
}

export interface StorageVideoCreateData extends NestStorage.VideoCreate {
  userId: string;
}

export interface StorageVideoList {
  total: number;
  items: StorageVideo[];
}
