import {
  GrpcBaseQuery,
  GrpcFile,
  GrpcFileCreateRequest,
  GrpcFileQuery,
  GrpcFileSignedUrls,
  GrpcFileUploadRequest,
  GrpcFileUploadResponse,
  GrpcFileUploadStatus,
  GrpcStorageObjectType,
} from '@backend/grpc';
import { CrudServiceImpl, PERSISTENCE_SERVICE, PersistenceService } from '@backend/persistence';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  concat,
  concatMap,
  finalize,
  firstValueFrom,
  from,
  ignoreElements,
  Observable,
  of,
  share,
  switchMap,
  take,
  takeWhile,
  tap,
  timeout,
} from 'rxjs';

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
    @Inject(PERSISTENCE_SERVICE) private readonly persistenceService: PersistenceService,
  ) {
    super();
  }

  async getSignedUrls(request: GrpcBaseQuery): Promise<GrpcFileSignedUrls> {
    const files = await this.repository.getMany(request);
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
  ): Observable<Either<Error, GrpcFileUploadResponse>> {
    const sharedRequest$ = request$.pipe(share());

    type Params = {
      file: GrpcFile;
      upload$: PassThrough;
      uploadPromise: Promise<boolean>;
    };

    let uploadedFile: GrpcFile;

    return sharedRequest$.pipe(
      take(1),
      timeout(5_000),
      switchMap(async (message): Promise<Params> => {
        if (!user) {
          throw new ForbiddenException(`User is required`);
        }

        if (!message.file) {
          throw new ConflictException('File id should be provided before chunks');
        }

        const file = await this.persistenceService.isolatedRun(async () => {
          return this.repository.getOne({ id: message.file, user });
        });

        if (file.isLeft()) {
          throw file.value;
        }

        if (file.value.uploadStatus === GrpcFileUploadStatus.READY) {
          throw new BadRequestException('File should have pending or failed upload status');
        }

        const upload$ = new PassThrough();

        uploadedFile = file.value;

        const uploadPromise = firstValueFrom(
          this.fileStorageService.uploadFile(uploadedFile, upload$),
        );

        uploadPromise.catch(() => {});

        return { file: file.value, upload$, uploadPromise };
      }),
      switchMap(
        ({ file, upload$, uploadPromise }): Observable<Either<Error, GrpcFileUploadResponse>> => {
          let totalBytes = 0;

          const initialResponse = of(right({ canSendChunks: true }));

          const chunkProcessor$ = sharedRequest$.pipe(
            timeout(10_000),
            concatMap(async (message): Promise<number> => {
              if (!message.chunk) {
                throw new ConflictException('Only chunks should be provided after file id');
              }

              await sendToWritable(upload$, Buffer.from(message.chunk));
              totalBytes += message.chunk.length;
              return (totalBytes / uploadedFile.size) * 100;
            }),
            takeWhile((percent) => percent < 100, true),
            tap({
              complete: () => {
                upload$.end();
              },
            }),
            ignoreElements(),
            catchError((err) => {
              upload$.destroy();
              throw err;
            }),
          );

          const finalResponse = from(uploadPromise).pipe(
            concatMap(async (isUploaded) => {
              if (!isUploaded) {
                throw new InternalServerErrorException('File upload failed');
              }

              if (totalBytes < uploadedFile.size) {
                throw new InternalServerErrorException('File upload interrupted: size mismatch');
              }

              const updatedFile = await this.persistenceService.isolatedRun(async () => {
                return this.updateById(uploadedFile.id, {
                  set: {
                    uploadStatus: GrpcFileUploadStatus.READY,
                  },
                });
              });

              if (updatedFile.isLeft()) {
                throw updatedFile.value;
              }

              this.logger.log(`File ${uploadedFile.id} uploaded`);
              return right({ file: updatedFile.value });
            }),
          );

          return concat(initialResponse, chunkProcessor$, finalResponse).pipe(
            finalize(() => {
              if (!upload$.destroyed) {
                upload$.destroy();
              }
            }),
          );
        },
      ),
      catchError(async (err) => {
        this.logger.error('File upload error:', err.message, err.stack);

        if (uploadedFile?.id) {
          await Promise.allSettled([
            this.persistenceService.isolatedRun(async () => {
              await this.updateById(uploadedFile.id, {
                set: {
                  uploadStatus: GrpcFileUploadStatus.FAILED,
                },
              });
            }),
            firstValueFrom(this.fileStorageService.deleteFile(uploadedFile)),
          ]);
        }

        return left(err);
      }),
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupFiles() {
    try {
      await this.persistenceService.isolatedRun(async () => {
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
