import { GrpcFileCreate } from '@backend/grpc';
import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { PassThrough } from 'node:stream';

export const FILE_STORAGE_SERVICE = Symbol('FileStorageService');

export interface FileStorageService {
  createFile(
    data: FileStorageCreateData,
  ):
    | Either<InternalServerErrorException, string>
    | Promise<Either<InternalServerErrorException, string>>;
  uploadFile(providerId: string, fileSize: number, upload$: PassThrough): Promise<boolean>;
  deleteFile(providerId: string): Promise<Either<InternalServerErrorException, boolean>>;
  getFileSignedUrl(
    providerId: string,
    ip?: string,
  ): Either<Error, string> | Promise<Either<Error, string>>;
}

export interface FileStorageCreateData extends GrpcFileCreate {
  userId: string;
}
