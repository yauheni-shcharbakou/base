import { GrpcVideo, GrpcVideoCreate, GrpcVideoUpdateSet } from '@backend/grpc';
import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { PassThrough } from 'node:stream';

export const VIDEO_STORAGE_SERVICE = Symbol('VideoStorageService');

export interface VideoStorageService {
  createVideo(
    data: VideoStorageCreateData,
  ):
    | Either<InternalServerErrorException, string>
    | Promise<Either<InternalServerErrorException, string>>;
  uploadVideo(providerId: string, fileSize: number, upload$: PassThrough): Promise<boolean>;
  deleteVideo(providerId: string): Promise<Either<InternalServerErrorException, boolean>>;
  updateVideo(providerId: string, updateData: GrpcVideoUpdateSet): Promise<Either<Error, boolean>>;
  getList(page: number, limit: number): Promise<VideoStorageList>;
  getPlayerUrl(
    providerId: string,
    ip?: string,
  ): Either<Error, string> | Promise<Either<Error, string>>;
  getDownloadUrl(
    providerId: string,
    ip?: string,
  ): Either<Error, string> | Promise<Either<Error, string>>;
}

export interface VideoStorageCreateData extends GrpcVideoCreate {
  userId: string;
}

export interface VideoStorageData extends Pick<GrpcVideo, 'providerId' | 'duration' | 'views'> {}

export interface VideoStorageList {
  total: number;
  items: VideoStorageData[];
}
