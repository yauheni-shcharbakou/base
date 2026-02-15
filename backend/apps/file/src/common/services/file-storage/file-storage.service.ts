import { GrpcFile } from '@backend/grpc';
import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { PassThrough } from 'node:stream';
import { Observable } from 'rxjs';

export const FILE_STORAGE_SERVICE = Symbol('FileStorageService');

export interface FileStorageService {
  uploadFile(file: GrpcFile, upload$: PassThrough): Observable<boolean>;
  deleteFile(file: GrpcFile): Observable<Either<InternalServerErrorException, boolean>>;
  getFileSignedUrl(file: GrpcFile): Observable<Either<Error, string>>;
}
