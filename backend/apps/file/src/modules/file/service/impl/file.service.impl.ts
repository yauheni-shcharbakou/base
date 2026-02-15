import { GrpcBaseQuery, GrpcFile, GrpcFileSignedUrls, GrpcFileUpload } from '@backend/grpc';
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
  concatMap,
  filter,
  finalize,
  firstValueFrom,
  map,
  Observable,
  of,
  switchMap,
  take,
  timeout,
} from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

type MessageResult =
  | {
      phase: 'create';
      file: GrpcFile;
    }
  | { phase: 'chunk' }
  | { phase: 'skip' }
  | { phase: 'finish' };

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
    request$: Observable<GrpcFileUpload>,
    user?: string,
  ): Observable<Either<Error, GrpcFile>> {
    let createdFile: GrpcFile;
    let isSuccess = false;
    let uploadPromise: Promise<any>;

    const upload$ = new PassThrough();

    return request$.pipe(
      timeout(30_000),
      concatMap(async (message): Promise<MessageResult> => {
        if (message.create) {
          if (!user) {
            throw new BadRequestException(`User is required`);
          }

          const file = await this.fileRepository.saveOne({ ...message.create, user });

          if (file.isLeft()) {
            throw file.value;
          }

          createdFile = file.value;
          uploadPromise = firstValueFrom(this.fileStorageService.uploadFile(createdFile, upload$));
          return { phase: 'create', file: createdFile };
        }

        if (message.chunk) {
          await sendToWritable(upload$, Buffer.from(message.chunk));
          return { phase: 'chunk' };
        }

        if (message.isFinished) {
          return { phase: 'finish' };
        }

        return { phase: 'skip' };
      }),
      catchError((err) => {
        throw err;
      }),
      filter((res) => res.phase === 'finish'),
      take(1),
      concatMap(async () => {
        if (!createdFile) {
          throw new Error('No data received');
        }

        upload$.end();
        await uploadPromise;

        isSuccess = true;
        this.logger.log(`File ${createdFile.id} uploaded`);
        return right(createdFile);
      }),
      catchError((err) => {
        this.logger.error('File upload error:', err.message, err.stack);
        const errorResult = left(err);

        upload$.destroy();

        if (!createdFile?.id) {
          return of(errorResult);
        }

        return fromPromise(this.fileRepository.deleteById(createdFile.id)).pipe(
          map(() => errorResult),
        );
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
