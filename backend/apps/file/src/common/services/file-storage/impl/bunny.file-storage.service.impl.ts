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
  private readonly cdnConfig: Config['bunny']['cdn'];
  private readonly rootDir: string;

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

    const config = this.configService.getOrThrow('bunny', { infer: true });

    this.cdnConfig = config.cdn;
    this.rootDir = config.storage.rootDir;
  }

  private getFilePath(file: GrpcFile): string {
    return `${this.rootDir}/${file.user}/${file.id}.${file.extension}`;
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
      })
      .pipe(map(() => true));
  }

  getFileSignedUrl(file: GrpcFile): Observable<Either<Error, string>> {
    try {
      const filePath = this.getFilePath(file);
      const path = `/${filePath}`;
      const expires = moment().add(this.cdnConfig.expiresInMinutes, 'minutes').unix();
      const hashableBase = this.cdnConfig.privateKey + path + expires;
      const md5String = createHash('md5').update(hashableBase).digest('binary');

      const token = Buffer.from(md5String, 'binary')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const url = new URL(this.cdnConfig.url + path);

      url.searchParams.set('token', token);
      url.searchParams.set('expires', expires.toString());

      return of(right(url.toString()));
    } catch (error) {
      return of(left(error));
    }
  }
}
