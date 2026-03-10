import { GrpcFile } from '@backend/grpc';
import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Either, left, right } from '@sweet-monads/either';
import { AxiosError } from 'axios';
import { FileStorageService } from 'common/services/file-storage/file-storage.service';
import { Config } from 'config';
import moment from 'moment';
import { createHash } from 'node:crypto';
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

  private getFilePath(file: GrpcFile): string {
    return `${this.storageConfig.rootDir}/${file.userId}/${file.id}.${file.extension}`;
  }

  deleteFile(file: GrpcFile): Observable<Either<InternalServerErrorException, boolean>> {
    return this.httpService.delete(this.getFilePath(file)).pipe(
      map(() => right(true)),
      catchError((error) =>
        of(left(new InternalServerErrorException("Can't delete file from bunny storage"))),
      ),
    );
  }

  uploadFile(file: GrpcFile, upload$: PassThrough): Observable<boolean> {
    return this.httpService
      .put(this.getFilePath(file), upload$, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': file.size.toString(),
        },
        timeout: 0,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })
      .pipe(map(() => true));
  }

  getFileSignedUrl(file: GrpcFile): Either<Error, string> {
    try {
      const filePath = this.getFilePath(file);
      const path = `/${filePath}`;
      const expires = moment().add(this.storageConfig.cdn.expiresInMinutes, 'minutes').unix();
      const hashableBase = this.storageConfig.cdn.privateKey + path + expires;
      const md5String = createHash('md5').update(hashableBase).digest('binary');

      const token = Buffer.from(md5String, 'binary')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const url = new URL(`https://${this.storageConfig.cdn.zone}.b-cdn.net${path}`);

      url.searchParams.set('token', token);
      url.searchParams.set('expires', expires.toString());

      return right(url.toString());
    } catch (error) {
      return left(error);
    }
  }
}
