import { GrpcFileCreate } from '@backend/grpc';
import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { PassThrough } from 'node:stream';
import { Observable } from 'rxjs';

export const FILE_STORAGE_SERVICE = Symbol('FileStorageService');

export interface FileStorageService {
  createFile(data: FileStorageCreateData): Observable<Either<InternalServerErrorException, string>>;
  uploadFile(providerId: string, fileSize: number, upload$: PassThrough): Observable<boolean>;
  deleteFile(providerId: string): Observable<Either<InternalServerErrorException, boolean>>;
  getFileSignedUrl(providerId: string): Either<Error, string> | Promise<Either<Error, string>>;
}

export interface FileStorageCreateData extends Omit<GrpcFileCreate, 'providerId'> {}
