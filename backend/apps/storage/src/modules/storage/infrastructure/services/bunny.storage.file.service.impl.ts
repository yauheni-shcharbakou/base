import {
  DeleteObjectCommand,
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
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { BunnyStorageConfig } from '../configs/bunny.storage.config';
import { FILE_S3_CLIENT } from '../constants/client.tokens';

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

  createFile(data: StorageFileCreateData): Either<InternalServerErrorException, string> {
    const extension = extname(data.originalName).replace(/^./g, '');
    const filePath = `${this.storageConfig.rootDir}/${data.userId}/${randomUUID()}.${extension}`;
    return right(filePath);
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

  // No client address goes into the token: the browser reaches the CDN over its own route, which
  // the server that signs never sees (ADR-0025).
  getFileSignedUrl(providerId: string): Either<Error, string> {
    try {
      const path = `/${providerId}`;
      const { url: cdnUrl, privateKey, expiresInMinutes } = this.storageConfig.cdn;

      const expires = moment().add(expiresInMinutes, 'minutes').unix();
      const hashableBase = privateKey + path + expires;
      const md5String = createHash('md5').update(hashableBase).digest('binary');

      const token = Buffer.from(md5String, 'binary')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const url = new URL(cdnUrl + path);

      url.searchParams.set('token', token);
      url.searchParams.set('expires', expires.toString());

      return right(url.toString());
    } catch (error) {
      return left(error);
    }
  }
}
