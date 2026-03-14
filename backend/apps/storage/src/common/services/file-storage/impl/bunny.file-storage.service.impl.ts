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
import moment from 'moment';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PassThrough } from 'node:stream';
import { catchError, map, Observable, of } from 'rxjs';

@Injectable()
export class BunnyFileStorageServiceImpl implements FileStorageService {
  private readonly logger = new Logger(BunnyFileStorageServiceImpl.name);
  private readonly storageConfig: Config['bunny']['storage'];

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
  }

  createFile(
    data: FileStorageCreateData,
  ): Observable<Either<InternalServerErrorException, string>> {
    const extension = extname(data.originalName).replace(/^./g, '');
    const filePath = `${this.storageConfig.rootDir}/${data.userId}/${randomUUID()}.${extension}`;
    return of(right(filePath));
  }

  deleteFile(providerId: string): Observable<Either<InternalServerErrorException, boolean>> {
    return this.httpService.delete(providerId).pipe(
      map(() => right(true)),
      catchError((error) =>
        of(left(new InternalServerErrorException("Can't delete file from bunny storage"))),
      ),
    );
  }

  uploadFile(providerId: string, fileSize: number, upload$: PassThrough): Observable<boolean> {
    return this.httpService
      .put(providerId, upload$, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileSize.toString(),
        },
        timeout: 0,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })
      .pipe(map(() => true));
  }

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
