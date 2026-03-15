import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcFile,
  GrpcFileCreate,
  GrpcFileCreateRequest,
  GrpcFileQuery,
  GrpcFileUploadRequest,
  GrpcFileUploadResponse,
  GrpcFileUploadStatus,
  GrpcStorageObjectType,
  GrpcUrlMap,
} from '@backend/grpc';
import { CrudServiceImpl, PERSISTENCE_SERVICE, PersistenceService } from '@backend/persistence';
import { NatsJsClient, ProviderIdEvent } from '@backend/transport';
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
import { FILE_REPOSITORY, FileRepository } from 'common/repositories/file/file.repository';
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
  extends CrudServiceImpl<GrpcFile, GrpcFileQuery, GrpcFileCreate>
  implements FileService
{
  private readonly logger = new Logger(FileServiceImpl.name);

  constructor(
    @Inject(FILE_REPOSITORY) protected readonly repository: FileRepository,
    @Inject(STORAGE_OBJECT_REPOSITORY)
    private readonly storageObjectRepository: StorageObjectRepository,
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorageService: FileStorageService,
    @Inject(PERSISTENCE_SERVICE) private readonly persistenceService: PersistenceService,
    private readonly natsJsClient: NatsJsClient,
  ) {
    super();
  }

  async getUrlMap(request: GrpcBaseQuery): Promise<GrpcUrlMap> {
    const files = await this.repository.getMany(request);
    const items: GrpcUrlMap['items'] = {};

    await Promise.all(
      _.map(files, async (file) => {
        if (!file.providerId) {
          return;
        }

        const url = await this.fileStorageService.getFileSignedUrl(file.providerId);

        if (url.isRight()) {
          items[file.id] = url.value;
        }
      }),
    );

    return { items };
  }

  async getDownloadMap(request: GrpcBaseQuery): Promise<GrpcDownloadMap> {
    const files = await this.repository.getMany(request);
    const items: GrpcDownloadMap['items'] = {};

    await Promise.all(
      _.map(files, async (file) => {
        if (!file.providerId) {
          return;
        }

        const url = await this.fileStorageService.getFileSignedUrl(file.providerId);

        if (url.isRight()) {
          items[file.id] = {
            url: url.value,
            fileName: `${file.id}.${file.extension}`,
          };
        }
      }),
    );

    return { items };
  }

  async deleteById(id: string): Promise<Either<NotFoundException, GrpcFile>> {
    const file = await super.deleteById(id);

    if (file.isRight() && file.value.uploadStatus === GrpcFileUploadStatus.READY) {
      await firstValueFrom(
        this.natsJsClient.storage.file.deleteOne({ providerId: file.value.providerId }),
      );
    }

    return file;
  }

  async createOne(
    request: GrpcFileCreateRequest,
    userId: string,
  ): Promise<Either<Error, GrpcFile>> {
    const providerId = await firstValueFrom(
      this.fileStorageService.createFile({ ...request.file, userId }),
    );

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const file = await this.repository.saveOne({
      ...request.file,
      userId,
      providerId: providerId.value,
    });

    if (file.isLeft() || !request.storage) {
      return file;
    }

    const storage = await this.storageObjectRepository.saveOne({
      ...request.storage,
      userId,
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
    userId?: string,
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
        if (!userId) {
          throw new ForbiddenException(`User is required`);
        }

        if (!message.file) {
          throw new ConflictException('File id should be provided before chunks');
        }

        const file = await this.persistenceService.isolatedRun(async () => {
          return this.repository.getOne({ id: message.file, userId });
        });

        if (file.isLeft()) {
          throw file.value;
        }

        if (!file.value.providerId) {
          throw new BadRequestException('File should have providerId');
        }

        if (file.value.uploadStatus === GrpcFileUploadStatus.READY) {
          throw new BadRequestException('File should have pending or failed upload status');
        }

        const upload$ = new PassThrough();

        uploadedFile = file.value;

        const uploadPromise = firstValueFrom(
          this.fileStorageService.uploadFile(uploadedFile.providerId, uploadedFile.size, upload$),
        );

        uploadPromise.catch(() => {});

        return { file: uploadedFile, upload$, uploadPromise };
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
              return (totalBytes / file.size) * 100;
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

              if (totalBytes < file.size) {
                throw new InternalServerErrorException('File upload interrupted: size mismatch');
              }

              const updatedFile = await this.persistenceService.isolatedRun(async () => {
                return this.updateById(file.id, {
                  set: {
                    uploadStatus: GrpcFileUploadStatus.READY,
                  },
                });
              });

              if (updatedFile.isLeft()) {
                throw updatedFile.value;
              }

              this.logger.log(`File ${file.id} uploaded`);
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
            firstValueFrom(
              this.natsJsClient.storage.file.deleteOne({ providerId: uploadedFile.providerId }),
            ),
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

  async onFileDelete(data: ProviderIdEvent): Promise<void> {
    await firstValueFrom(this.fileStorageService.deleteFile(data.providerId));
  }
}
