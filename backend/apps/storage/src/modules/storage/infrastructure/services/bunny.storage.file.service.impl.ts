import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NestStorage } from '@backend/proto';
import {
  StorageFileCreateData,
  StorageFileService,
  StorageFileUploadData,
} from '@modules/storage/domain/services/storage.file.service';
import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Either, left, right } from '@sweet-monads/either';
import moment from 'moment';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { BunnyStorageConfig } from '../configs/bunny.storage.config';
import { FILE_S3_CLIENT } from '../constants/client.tokens';
import { signBunnyCdnUrl } from '../utils/bunny.cdn-token';

@Injectable()
export class BunnyStorageFileServiceImpl implements StorageFileService {
  private readonly logger = new Logger(BunnyStorageFileServiceImpl.name);
  private readonly storageConfig: BunnyStorageConfig['bunny']['storage'];

  constructor(
    private readonly configService: ConfigService<BunnyStorageConfig>,
    @Inject(FILE_S3_CLIENT) private readonly s3Client: S3Client,
  ) {
    this.storageConfig = this.configService.getOrThrow('bunny.storage', { infer: true });
  }

  get uploadWindowMinutes(): number {
    return this.storageConfig.s3.uploadExpiresInMinutes;
  }

  createFile(data: StorageFileCreateData): Either<InternalServerErrorException, string> {
    const extension = extname(data.originalName).replace(/^./g, '');
    const filePath = `${this.storageConfig.rootDir}/${data.userId}/${randomUUID()}.${extension}`;
    return right(filePath);
  }

  // Beside the original, under the same uuid, so a listing of the owner's directory shows the pair.
  createPreviewKey(providerId: string): string {
    const extension = extname(providerId);
    return `${extension ? providerId.slice(0, -extension.length) : providerId}.preview.webp`;
  }

  async deleteFile(providerId: string): Promise<Either<InternalServerErrorException, boolean>> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.storageConfig.s3.bucket, Key: providerId }),
      );
      return right(true);
    } catch (err) {
      this.logger.error(`Bunny storage delete failed for ${providerId}`, err?.stack);
      return left(new InternalServerErrorException("Can't delete file from bunny storage"));
    }
  }

  async getUploadUrl(
    providerId: string,
    data: StorageFileUploadData,
  ): Promise<Either<InternalServerErrorException, NestStorage.FilePresignedUpload>> {
    const { bucket, uploadExpiresInMinutes } = this.storageConfig.s3;
    const expiresIn = uploadExpiresInMinutes * 60;

    try {
      // Content-Type and Content-Length are signed headers: the browser must send exactly this
      // type, and a body of any other length fails the signature. `completeUpload` still checks
      // the stored size, since that is the one guarantee not left to the provider.
      const url = await getSignedUrl(
        this.s3Client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: providerId,
          ContentType: data.mimeType,
          ContentLength: data.size,
        }),
        { expiresIn },
      );

      return right({
        url,
        contentType: data.mimeType,
        expires: moment().add(expiresIn, 'seconds').unix().toString(),
      });
    } catch (err) {
      this.logger.error(`Bunny storage presign failed for ${providerId}`, err?.stack);
      return left(new InternalServerErrorException("Can't sign a bunny storage upload"));
    }
  }

  async getObjectSize(
    providerId: string,
  ): Promise<Either<InternalServerErrorException, number | null>> {
    try {
      const head = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.storageConfig.s3.bucket, Key: providerId }),
      );

      return right(head.ContentLength ?? null);
    } catch (err) {
      if (err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404) {
        return right(null);
      }

      this.logger.error(`Bunny storage head failed for ${providerId}`, err?.stack);
      return left(new InternalServerErrorException("Can't read a file from bunny storage"));
    }
  }

  async getObjectStream(
    providerId: string,
  ): Promise<Either<InternalServerErrorException, Readable | null>> {
    try {
      const object = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.storageConfig.s3.bucket, Key: providerId }),
      );

      // In Node the SDK's body is an `IncomingMessage`, a `Readable` under a wider type.
      return right((object.Body as Readable | undefined) ?? null);
    } catch (err) {
      if (err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404) {
        return right(null);
      }

      this.logger.error(`Bunny storage get failed for ${providerId}`, err?.stack);
      return left(new InternalServerErrorException("Can't read a file from bunny storage"));
    }
  }

  async putObject(
    providerId: string,
    body: Buffer,
    contentType: string,
  ): Promise<Either<InternalServerErrorException, true>> {
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.storageConfig.s3.bucket,
          Key: providerId,
          Body: body,
          ContentType: contentType,
        }),
      );
      return right(true);
    } catch (err) {
      this.logger.error(`Bunny storage put failed for ${providerId}`, err?.stack);
      return left(new InternalServerErrorException("Can't write a file to bunny storage"));
    }
  }

  getFileSignedUrl(providerId: string): Either<Error, string> {
    try {
      const { url, privateKey, expiresInMinutes } = this.storageConfig.cdn;

      return right(
        signBunnyCdnUrl({ baseUrl: url, path: `/${providerId}`, privateKey, expiresInMinutes }),
      );
    } catch (error) {
      return left(error);
    }
  }
}
