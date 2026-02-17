import {
  GrpcBaseQuery,
  GrpcFile,
  GrpcFileSignedUrls,
  GrpcFileUploadRequest,
  GrpcFileUploadResponse,
} from '@backend/grpc';
import { BadRequestException, HttpException, Inject, Logger } from '@nestjs/common';
import { sendToWritable } from '@packages/common';
import { Either, left, right } from '@sweet-monads/either';
import { FILE_REPOSITORY, FileRepository } from 'common/repositories/file/file.repository';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from 'common/services/file-storage/file-storage.service';
import _ from 'lodash';
import { FileService } from 'modules/file/service/file.service';
import { PassThrough } from 'node:stream';
import {
  catchError,
  concat,
  concatMap,
  defer,
  filter,
  finalize,
  firstValueFrom,
  map,
  Observable,
  of,
  switchMap,
  takeWhile,
  timeout,
} from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

export class FileServiceImpl implements FileService {
  private readonly logger = new Logger(FileServiceImpl.name);

  constructor(
    @Inject(FILE_REPOSITORY) private readonly fileRepository: FileRepository,
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorageService: FileStorageService,
  ) {}

  getSignedUrls(request: GrpcBaseQuery): Observable<GrpcFileSignedUrls> {
    return fromPromise(this.fileRepository.getMany(request)).pipe(
      concatMap(async (files) => {
        const urls: GrpcFileSignedUrls['urls'] = {};

        await Promise.all(
          _.map(files, async (file) => {
            const url = await firstValueFrom(this.fileStorageService.getFileSignedUrl(file));

            if (url.isRight()) {
              urls[file.id] = url.value;
            }
          }),
        );

        return { urls };
      }),
    );
  }

  deleteById(id: string): Observable<Either<HttpException, GrpcFile>> {
    return fromPromise(this.fileRepository.deleteById(id)).pipe(
      switchMap((file) => {
        if (file.isLeft()) {
          return of(left(file.value));
        }

        return this.fileStorageService.deleteFile(file.value).pipe(map((_) => right(file.value)));
      }),
    );
  }

  uploadOne(
    request$: Observable<GrpcFileUploadRequest>,
    user?: string,
  ): Observable<Either<Error, GrpcFileUploadResponse>> {
    let createdFile: GrpcFile;
    let isSuccess = false;
    let uploadPromise: Promise<any>;
    let totalBytes = 0;

    const upload$ = new PassThrough();

    const progress$ = request$.pipe(
      timeout(30_000),
      concatMap(async (message): Promise<GrpcFileUploadResponse | null> => {
        if (message.create) {
          if (!user) {
            throw new BadRequestException('User is required');
          }

          const file = await this.fileRepository.saveOne({ ...message.create, user });

          if (file.isLeft()) {
            throw file.value;
          }

          createdFile = file.value;
          uploadPromise = firstValueFrom(this.fileStorageService.uploadFile(createdFile, upload$));
          return null;
        }

        if (message.chunk) {
          await sendToWritable(upload$, Buffer.from(message.chunk));
          totalBytes += message.chunk.length;
          const percent = (totalBytes / createdFile.size) * 100;
          return { percent };
        }

        return null;
      }),
      filter((res) => !!res),
      takeWhile((res) => res.percent < 100, true),
      map((res) => right({ percent: res.percent })),
    );

    const finish$ = defer(async (): Promise<Either<Error, GrpcFileUploadResponse>> => {
      if (!createdFile) {
        throw new Error('File was not created');
      }

      if (totalBytes < createdFile.size) {
        throw new Error('File upload interrupted: size mismatch');
      }

      upload$.end();
      await uploadPromise;

      isSuccess = true;
      this.logger.log(`File ${createdFile.id} uploaded`);
      return right({ file: createdFile });
    });

    return concat(progress$, finish$).pipe(
      catchError(async (err) => {
        this.logger.error('File upload error:', err.message, err.stack);
        upload$.destroy();

        if (createdFile?.id) {
          await firstValueFrom(this.deleteById(createdFile.id));
        }

        return left(err);
      }),
      finalize(() => {
        if (!isSuccess) {
          if (!upload$.destroyed) {
            upload$.destroy();
          }

          if (createdFile) {
            this.fileStorageService.deleteFile(createdFile);
          }
        }
      }),
    );
  }
}
