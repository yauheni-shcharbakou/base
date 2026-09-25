import { NestStorage } from '@backend/proto';
import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

export abstract class StorageFileService {
  abstract createFile(
    data: StorageFileCreateData,
  ):
    | Either<InternalServerErrorException, string>
    | Promise<Either<InternalServerErrorException, string>>;
  abstract getUploadUrl(
    providerId: string,
    data: StorageFileUploadData,
  ): Promise<Either<InternalServerErrorException, NestStorage.FilePresignedUpload>>;
  /** Size of the stored object in bytes, or `null` when nothing was uploaded under the key. */
  abstract getObjectSize(
    providerId: string,
  ): Promise<Either<InternalServerErrorException, number | null>>;
  abstract deleteFile(providerId: string): Promise<Either<InternalServerErrorException, boolean>>;
  abstract getFileSignedUrl(
    providerId: string,
    ip?: string,
  ): Either<Error, string> | Promise<Either<Error, string>>;
}

export interface StorageFileCreateData extends NestStorage.FileCreate {
  userId: string;
}

export type StorageFileUploadData = Pick<NestStorage.File, 'mimeType' | 'size'>;
