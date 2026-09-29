import { NestStorage } from '@backend/proto';
import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { Readable } from 'node:stream';

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
  /** The key of the preview made for the object under `providerId` — derived, so stable. */
  abstract createPreviewKey(providerId: string): string;
  abstract deleteFile(providerId: string): Promise<Either<InternalServerErrorException, boolean>>;
  /**
   * The stored bytes as a stream, or `null` when nothing is stored under the key. The caller must
   * consume or destroy the stream: an unread body holds its connection open.
   */
  abstract getObjectStream(
    providerId: string,
  ): Promise<Either<InternalServerErrorException, Readable | null>>;
  /** Writes a small object the service made itself, in one request — never a client's upload. */
  abstract putObject(
    providerId: string,
    body: Buffer,
    contentType: string,
  ): Promise<Either<InternalServerErrorException, true>>;
  /**
   * A time-limited CDN URL, bound to no client address: whoever holds it may read the object until
   * it expires.
   */
  abstract getFileSignedUrl(providerId: string): Either<Error, string>;
}

export interface StorageFileCreateData extends NestStorage.FileCreate {
  userId: string;
}

export type StorageFileUploadData = Pick<NestStorage.File, 'mimeType' | 'size'>;
