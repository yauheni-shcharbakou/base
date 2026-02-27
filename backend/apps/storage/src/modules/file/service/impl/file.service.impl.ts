import {
  GrpcBaseQuery,
  GrpcFile,
  GrpcFileCreateRequest,
  GrpcFileQuery,
  GrpcFileSignedUrls,
  GrpcFileUploadRequest,
  GrpcFileUploadStatus,
  GrpcStorageObjectType,
} from '@backend/grpc';
import { CrudServiceImpl } from '@backend/persistence';
import { CreateRequestContext } from '@mikro-orm/core';
import {
  BadRequestException,
  ConflictException,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { sendToWritable } from '@packages/common';
import { Either, left, right } from '@sweet-monads/either';
import {
  FILE_REPOSITORY,
  FileCreate,
  FileRepository,
} from 'common/repositories/file/file.repository';
import {
  STORAGE_OBJECT_REPOSITORY,
  StorageObjectRepository,
} from 'common/repositories/storage-object/storage-object.repository';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from 'common/services/file-storage/file-storage.service';
import _ from 'lodash';
import { FileService } from 'modules/file/service/file.service';
import moment from 'moment';
import { PassThrough } from 'node:stream';
import {
  catchError,
  concatMap,
  filter,
  finalize,
  firstValueFrom,
  Observable,
  take,
  timeout,
} from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

export class FileServiceImpl
  extends CrudServiceImpl<GrpcFile, GrpcFileQuery, FileCreate>
  implements FileService
{
  private readonly logger = new Logger(FileServiceImpl.name);

  constructor(
    @Inject(FILE_REPOSITORY) protected readonly repository: FileRepository,
    @Inject(STORAGE_OBJECT_REPOSITORY)
    private readonly storageObjectRepository: StorageObjectRepository,
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorageService: FileStorageService,
  ) {
    super();
  }

  getSignedUrls(request: GrpcBaseQuery): Observable<GrpcFileSignedUrls> {
    return fromPromise(this.repository.getMany(request)).pipe(
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

  async deleteById(id: string): Promise<Either<NotFoundException, GrpcFile>> {
    const file = await super.getById(id);

    if (file.isLeft()) {
      return file;
    }

    const deletedFile = await super.deleteById(file.value.id);

    if (deletedFile.isRight() && file.value.uploadStatus === GrpcFileUploadStatus.READY) {
      await firstValueFrom(this.fileStorageService.deleteFile(file.value));
    }

    return deletedFile;
  }

  async createOne(request: GrpcFileCreateRequest, user: string): Promise<Either<Error, GrpcFile>> {
    const file = await this.saveOne({ ...request.file, user });

    if (file.isLeft() || !request.storage) {
      return file;
    }

    const storage = await this.storageObjectRepository.saveOne({
      ...request.storage,
      user,
      file: file.value.id,
      type: GrpcStorageObjectType.FILE,
    });

    if (storage.isLeft()) {
      await this.repository.deleteById(file.value.id);
      return left(storage.value);
    }

    return file;
  }

  uploadOne(
    request$: Observable<GrpcFileUploadRequest>,
    user?: string,
  ): Observable<Either<Error, GrpcFile>> {
    let uploadedFile: GrpcFile;
    let isSuccess = false;
    let uploadPromise: Promise<any>;
    let totalBytes = 0;

    const upload$ = new PassThrough();

    return request$.pipe(
      timeout(60_000),
      concatMap(async (message): Promise<number | null> => {
        if (message.file) {
          if (!user) {
            throw new BadRequestException(`User is required`);
          }

          const file = await this.repository.isolatedRun(async () => {
            return this.repository.getOne({ id: message.file, user });
          });

          if (file.isLeft()) {
            throw file.value;
          }

          uploadedFile = file.value;
          uploadPromise = firstValueFrom(this.fileStorageService.uploadFile(uploadedFile, upload$));
          return 0;
        }

        if (message.chunk) {
          if (!uploadedFile) {
            throw new ConflictException('File id should be provided before chunks');
          }

          await sendToWritable(upload$, Buffer.from(message.chunk));
          totalBytes += message.chunk.length;
          return (totalBytes / uploadedFile.size) * 100;
        }

        return null;
      }),
      catchError((err) => {
        throw err;
      }),
      filter((res) => res && res >= 100),
      take(1),
      concatMap(async () => {
        if (!uploadedFile) {
          throw new Error('No data received');
        }

        if (totalBytes < uploadedFile.size) {
          throw new Error('File upload interrupted: size mismatch');
        }

        upload$.end();
        await uploadPromise;

        const file = await this.repository.isolatedRun(async () => {
          return this.updateById(uploadedFile.id, {
            set: {
              uploadStatus: GrpcFileUploadStatus.READY,
            },
          });
        });

        if (file.isLeft()) {
          throw file.value;
        }

        isSuccess = true;
        this.logger.log(`File ${uploadedFile.id} uploaded`);
        return right(file.value);
      }),
      catchError(async (err) => {
        this.logger.error('File upload error:', err.message, err.stack);
        upload$.destroy();

        if (uploadedFile?.id) {
          await Promise.all([
            this.repository.isolatedRun(async () => {
              await this.updateById(uploadedFile.id, {
                set: {
                  uploadStatus: GrpcFileUploadStatus.FAILED,
                },
              });
            }),
            firstValueFrom(this.fileStorageService.deleteFile(uploadedFile)),
          ]);

          // this.eventEmitter.emit('file.delete', { id: uploadedFile.id });
        }

        return left(err);
      }),
      finalize(() => {
        if (!isSuccess && !upload$.destroyed) {
          upload$.destroy();
        }
      }),
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupFiles() {
    try {
      await this.repository.isolatedRun(async () => {
        let page = 1;
        let hasNext = true;
        const createdAfter = moment().subtract(1, 'hour').toDate();

        do {
          const { items, total } = await super.getList({
            query: {
              uploadStatuses: [GrpcFileUploadStatus.PENDING, GrpcFileUploadStatus.FAILED],
              createdAfter,
            },
            pagination: {
              page,
              limit: 100,
            },
          });

          if (items.length) {
            const ids = _.map(items, 'id');
            await this.repository.deleteMany({ ids });
          }

          hasNext = page * 100 < total;
          page += 1;
        } while (hasNext);
      });
    } catch (error) {
      this.logger.error('File cleanup error:', error.message, error.stack);
    }
  }

  // uploadOneDuplex(
  //   request$: Observable<GrpcFileUploadRequest>,
  //   user?: string,
  // ): Observable<Either<Error, GrpcFileUploadResponse>> {
  //   let createdFile: GrpcFile;
  //   let isSuccess = false;
  //   let uploadPromise: Promise<any>;
  //   let totalBytes = 0;
  //
  //   const upload$ = new PassThrough();
  //
  //   const progress$ = request$.pipe(
  //     timeout(30_000),
  //     concatMap(async (message): Promise<GrpcFileUploadResponse | null> => {
  //       if (message.create) {
  //         if (!user) {
  //           throw new BadRequestException('User is required');
  //         }
  //
  //         const file = await this.repository.saveOne({ ...message.create, user });
  //
  //         if (file.isLeft()) {
  //           throw file.value;
  //         }
  //
  //         createdFile = file.value;
  //         uploadPromise = firstValueFrom(this.fileStorageService.uploadFile(createdFile, upload$));
  //         return null;
  //       }
  //
  //       if (message.chunk) {
  //         await sendToWritable(upload$, Buffer.from(message.chunk));
  //         totalBytes += message.chunk.length;
  //         const percent = (totalBytes / createdFile.size) * 100;
  //         return { percent };
  //       }
  //
  //       return null;
  //     }),
  //     filter((res) => !!res),
  //     takeWhile((res) => res.percent < 100, true),
  //     map((res) => right({ percent: res.percent })),
  //   );
  //
  //   const finish$ = defer(async (): Promise<Either<Error, GrpcFileUploadResponse>> => {
  //     if (!createdFile) {
  //       throw new Error('File was not created');
  //     }
  //
  //     if (totalBytes < createdFile.size) {
  //       throw new Error('File upload interrupted: size mismatch');
  //     }
  //
  //     upload$.end();
  //     await uploadPromise;
  //
  //     isSuccess = true;
  //     this.logger.log(`File ${createdFile.id} uploaded`);
  //     return right({ file: createdFile });
  //   });
  //
  //   return concat(progress$, finish$).pipe(
  //     catchError(async (err) => {
  //       this.logger.error('File upload error:', err.message, err.stack);
  //       upload$.destroy();
  //
  //       if (createdFile?.id) {
  //         await firstValueFrom(this.deleteById(createdFile.id));
  //       }
  //
  //       return left(err);
  //     }),
  //     finalize(() => {
  //       if (!isSuccess) {
  //         if (!upload$.destroyed) {
  //           upload$.destroy();
  //         }
  //
  //         if (createdFile) {
  //           this.fileStorageService.deleteFile(createdFile);
  //         }
  //       }
  //     }),
  //   );
  // }
}
