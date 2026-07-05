import { NestStorage } from '@backend/proto';
import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { PassThrough } from 'node:stream';

export abstract class StorageFileService {
  abstract createFile(
    data: StorageFileCreateData,
  ):
    | Either<InternalServerErrorException, string>
    | Promise<Either<InternalServerErrorException, string>>;
  abstract uploadFile(providerId: string, fileSize: number, upload$: PassThrough): Promise<boolean>;
  abstract deleteFile(providerId: string): Promise<Either<InternalServerErrorException, boolean>>;
  abstract getFileSignedUrl(
    providerId: string,
    ip?: string,
  ): Either<Error, string> | Promise<Either<Error, string>>;
}

export interface StorageFileCreateData extends NestStorage.FileCreate {
  userId: string;
}
