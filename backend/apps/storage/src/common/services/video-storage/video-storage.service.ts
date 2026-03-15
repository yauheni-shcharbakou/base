import { GrpcVideo, GrpcVideoCreate, GrpcVideoMetadata } from '@backend/grpc';
import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { PassThrough } from 'node:stream';
import { Observable } from 'rxjs';

export const VIDEO_STORAGE_SERVICE = Symbol('VideoStorageService');

export interface VideoStorageService {
  createVideo(
    data: VideoStorageCreateData,
  ): Observable<Either<InternalServerErrorException, string>>;
  uploadVideo(providerId: string, fileSize: number, upload$: PassThrough): Observable<boolean>;
  deleteVideo(providerId: string): Observable<Either<InternalServerErrorException, boolean>>;
  updateVideo(
    providerId: string,
    updateData: Partial<GrpcVideoMetadata>,
  ): Observable<Either<Error, boolean>>;
  getList(page: number, limit: number): Observable<VideoStorageList>;
  getPlayerUrl(
    providerId: string,
    ip?: string,
  ): Either<Error, string> | Promise<Either<Error, string>>;
  getDownloadUrl(
    providerId: string,
    ip?: string,
  ): Either<Error, string> | Promise<Either<Error, string>>;
}

export interface VideoStorageCreateData extends Omit<GrpcVideoCreate, 'providerId' | 'file'> {}

export interface VideoStorageData extends Pick<GrpcVideo, 'providerId' | 'duration' | 'views'> {}

export interface VideoStorageList {
  total: number;
  items: VideoStorageData[];
}
