import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Either, left, right } from '@sweet-monads/either';
import { AxiosError } from 'axios';
import {
  FileStorageCreateData,
  FileStorageService,
} from 'common/services/file-storage/file-storage.service';
import { Config } from 'config';
import https from 'https';
import moment from 'moment';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PassThrough } from 'node:stream';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BunnyFileStorageServiceImpl implements FileStorageService {
  private readonly logger = new Logger(BunnyFileStorageServiceImpl.name);
  private readonly storageConfig: Config['bunny']['storage'];
  private readonly isDev: boolean;

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly httpService: HttpService,
  ) {
    this.httpService.axiosRef.interceptors.response.use(undefined, (axiosError: AxiosError) => {
      this.logger.error(
        'Bunny storage API error: ',
        JSON.stringify(
          {
            url: axiosError.config?.url,
            method: axiosError.config?.method,
            response: axiosError.response?.data,
          },
          null,
          2,
        ),
      );

      throw axiosError;
    });

    this.storageConfig = this.configService.getOrThrow('bunny.storage', { infer: true });
    this.isDev = this.configService.getOrThrow('isDevelopment', { infer: true });
  }

  createFile(data: FileStorageCreateData): Either<InternalServerErrorException, string> {
    const extension = extname(data.originalName).replace(/^./g, '');
    const filePath = `${this.storageConfig.rootDir}/${data.userId}/${randomUUID()}.${extension}`;
    return right(filePath);
  }

  async deleteFile(providerId: string): Promise<Either<InternalServerErrorException, boolean>> {
    try {
      await firstValueFrom(this.httpService.delete(providerId));
      return right(true);
    } catch (err) {
      return left(new InternalServerErrorException("Can't delete file from bunny storage"));
    }
  }

  uploadFile(providerId: string, fileSize: number, upload$: PassThrough): Promise<boolean> {
    const { apiUrl, apiKey } = this.storageConfig;
    const url = new URL(`${apiUrl}/${providerId}`);

    return new Promise<boolean>((resolve) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'PUT',
          headers: {
            AccessKey: apiKey,
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileSize.toString(),
          },
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
        },
      );

      req.on('error', (err) => {
        this.logger.error('Upload error', err.message, err.stack);
        resolve(false);
      });

      upload$.on('error', (err) => {
        if (!req.destroyed) {
          req.destroy(err);
        }
      });

      upload$.pipe(req);
    });
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
