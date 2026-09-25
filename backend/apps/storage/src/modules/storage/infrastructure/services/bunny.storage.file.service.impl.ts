import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  StorageFileCreateData,
  StorageFileService,
} from '@modules/storage/domain/services/storage.file.service';
import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Either, left, right } from '@sweet-monads/either';
import moment from 'moment';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PassThrough } from 'node:stream';
import { BunnyStorageConfig } from '../configs/bunny.storage.config';
import { FILE_S3_CLIENT } from '../constants/client.tokens';

@Injectable()
export class BunnyStorageFileServiceImpl implements StorageFileService {
  private readonly logger = new Logger(BunnyStorageFileServiceImpl.name);
  private readonly storageConfig: BunnyStorageConfig['bunny']['storage'];
  private readonly isDev: boolean;

  constructor(
    private readonly configService: ConfigService<BunnyStorageConfig>,
    @Inject(FILE_S3_CLIENT) private readonly s3Client: S3Client,
  ) {
    this.storageConfig = this.configService.getOrThrow('bunny.storage', { infer: true });
    this.isDev = this.configService.getOrThrow('isDevelopment', { infer: true });
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

  async uploadFile(providerId: string, fileSize: number, upload$: PassThrough): Promise<boolean> {
    try {
      // A single streamed PutObject: the SDK needs the length up front to send a stream unchunked.
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.storageConfig.s3.bucket,
          Key: providerId,
          Body: upload$,
          ContentLength: fileSize,
          ContentType: 'application/octet-stream',
        }),
      );
      return true;
    } catch (err) {
      this.logger.error(`Bunny storage upload failed for ${providerId}`, err?.stack);
      return false;
    }
  }

  getFileSignedUrl(providerId: string, ip?: string): Either<Error, string> {
    try {
      const path = `/${providerId}`;
      const { url: cdnUrl, privateKey, expiresInMinutes } = this.storageConfig.cdn;

      const expires = moment().add(expiresInMinutes, 'minutes').unix();

      let hashableBase = privateKey + path + expires;

      if (!this.isDev) {
        if (!ip) {
          throw new Error('Unsupported IP address');
        }

        hashableBase += ip;
      }

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
