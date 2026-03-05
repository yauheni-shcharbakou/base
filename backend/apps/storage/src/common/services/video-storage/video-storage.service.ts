import { GrpcVideoMetadata } from '@backend/grpc';
import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { PassThrough } from 'node:stream';
import { Observable } from 'rxjs';

export const VIDEO_STORAGE_SERVICE = Symbol('VideoStorageService');

export interface VideoStorageService {
  createVideo(video: GrpcVideoMetadata): Observable<Either<InternalServerErrorException, string>>;
  uploadVideo(providerId: string, fileSize: number, upload$: PassThrough): Observable<boolean>;
  deleteVideo(providerId: string): Observable<Either<InternalServerErrorException, boolean>>;
}
