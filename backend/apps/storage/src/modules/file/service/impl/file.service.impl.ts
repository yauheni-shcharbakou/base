import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcFile,
  GrpcFileCreate,
  GrpcFileCreateManyRequest,
  GrpcFileCreateManyResponse,
  GrpcFileCreateRequest,
  GrpcFileQuery,
  GrpcFileUploadResponse,
  GrpcFileUploadStatus,
  GrpcStorageObjectType,
  GrpcUploadRequest,
  GrpcUrlMap,
} from '@backend/grpc';
import { CrudServiceImpl, PERSISTENCE_SERVICE, PersistenceService } from '@backend/persistence';
import { InjectNatsClient, NatsClient, ProviderIdEvent } from '@backend/transport';
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
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from 'common/services/file-storage/file-storage.service';
import {
  STORAGE_OBJECT_SERVICE,
  StorageObjectService,
} from 'common/services/storage-object/storage-object.service';
import _ from 'lodash';
import { FileService } from 'modules/file/service/file.service';
import moment from 'moment';
import { PassThrough } from 'node:stream';
import {
  catchError,
  concat,
  concatMap,
  defer,
  finalize,
  firstValueFrom,
  Observable,
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
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorageService: FileStorageService,
    @Inject(STORAGE_OBJECT_SERVICE)
    private readonly storageObjectService: StorageObjectService,
    @Inject(PERSISTENCE_SERVICE) private readonly persistenceService: PersistenceService,
    @InjectNatsClient() private readonly natsClient: NatsClient,
  ) {
    super();
  }

  async getUrlMap(request: GrpcBaseQuery, ip?: string): Promise<GrpcUrlMap> {
    const files = await this.repository.getMany(request);
    const items: GrpcUrlMap['items'] = {};

    await Promise.all(
      _.map(files, async (file) => {
        if (!file.providerId) {
          return;
        }

        const url = await this.fileStorageService.getFileSignedUrl(file.providerId, ip);

        if (url.isRight()) {
          items[file.id] = url.value;
        }
      }),
    );

    return { items };
  }

  async getDownloadMap(request: GrpcBaseQuery, ip?: string): Promise<GrpcDownloadMap> {
    const files = await this.repository.getMany(request);
    const items: GrpcDownloadMap['items'] = {};

    await Promise.all(
      _.map(files, async (file) => {
        if (!file.providerId) {
          return;
        }

        const url = await this.fileStorageService.getFileSignedUrl(file.providerId, ip);

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
        this.natsClient.storage.file.deleteOne({ providerId: file.value.providerId }),
      );
    }

    return file;
  }

  async createOne(
    request: GrpcFileCreateRequest,
    userId: string,
  ): Promise<Either<Error, GrpcFile>> {
    const providerId = await this.fileStorageService.createFile({ ...request.file, userId });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const file = await this.repository.saveOne({
      ...request.file,
      userId,
      providerId: providerId.value,
      uploadId: providerId.value,
    });

    if (file.isLeft() || !request.storage) {
      return file;
    }

    const storage = await this.storageObjectService.createOne(
      {
        ...request.storage,
        type: GrpcStorageObjectType.FILE,
        file: file.value.id,
      },
      userId,
    );

    if (storage.isLeft()) {
      await this.repository.deleteById(file.value.id);
      return left(storage.value);
    }

    return file;
  }

  async createMany(
    request: GrpcFileCreateManyRequest,
    userId: string,
  ): Promise<Either<Error, GrpcFileCreateManyResponse>> {
    const fileNames = new Set(_.map(request.items, 'file.originalName'));

    if (fileNames.size !== request.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    try {
      const saveData: FileCreate[] = await Promise.all(
        _.map(request.items, async (item) => {
          const providerId = await this.fileStorageService.createFile({ ...item.file, userId });

          if (providerId.isLeft()) {
            throw providerId.value;
          }

          return {
            ...item.file,
            userId,
            providerId: providerId.value,
            uploadId: item.uploadId,
          };
        }),
      );

      const files = await this.repository.saveMany(saveData);

      if (files.isLeft()) {
        return left(files.value);
      }

      if (request.storage) {
        const storage = await this.storageObjectService.createManyFiles({
          ...request.storage,
          userId,
          files: _.map(files.value, (file) => {
            return {
              file: file.id,
              name: file.originalName,
              type: GrpcStorageObjectType.FILE,
            };
          }),
        });

        if (storage.isLeft()) {
          await this.repository.deleteMany({ ids: _.map(files.value, 'id') });
          return left(storage.value);
        }
      }

      return right({ items: files.value });
    } catch (error) {
      return left(error);
    }
  }

  uploadOne(
    request$: Observable<GrpcUploadRequest>,
    userId?: string,
  ): Observable<Either<Error, GrpcFileUploadResponse>> {
    type UploadContext = {
      file?: GrpcFile;
      upload$?: PassThrough;
      uploadPromise?: Promise<boolean>;
      processedBytes: number;
      totalBytes: number;
      isInitialized: boolean;
    };

    const context: UploadContext = {
      processedBytes: 0,
      totalBytes: 0,
      isInitialized: false,
    };

    const clearUpload = (upload$: PassThrough) => {
      if (upload$ && !upload$.destroyed) {
        upload$.end();
      }
    };

    const acks$ = request$.pipe(
      timeout(10_000),
      tap({
        complete: () => clearUpload(context.upload$),
      }),
      concatMap(async (message): Promise<Either<Error, GrpcFileUploadResponse>> => {
        if (!context.isInitialized) {
          // initialization phase, find entity and start uploading to storage provider

          if (!userId) {
            throw new ForbiddenException(`User is required`);
          }

          if (!message.id) {
            throw new ConflictException('File id should be provided before chunks');
          }

          const file = await this.persistenceService.isolatedRun(async () => {
            return this.repository.getOne({ id: message.id, userId });
          });

          if (file.isLeft()) {
            throw file.value;
          }

          context.file = file.value;

          if (!context.file.providerId) {
            throw new BadRequestException('File should have providerId');
          }

          if (context.file.uploadStatus === GrpcFileUploadStatus.READY) {
            throw new BadRequestException('File should have pending or failed upload status');
          }

          context.upload$ = new PassThrough({ highWaterMark: 0 });
          context.totalBytes = context.file.size;

          context.uploadPromise = this.fileStorageService.uploadFile(
            context.file.providerId,
            context.totalBytes,
            context.upload$,
          );

          context.uploadPromise.catch(() => {});
          context.isInitialized = true;
          return right({ canSendChunks: true }); // client signal for starting file streaming
        }

        // chunks processing phase

        if (!message.chunk) {
          throw new ConflictException('Only chunks should be provided after file id');
        }

        const chunk = Buffer.from(message.chunk);
        delete message.chunk;

        await sendToWritable(context.upload$, chunk);
        context.processedBytes += chunk.length;
        return right({ ack: true }); // client signal for sending next chunk
      }),
      takeWhile(() => !context.isInitialized || context.processedBytes < context.totalBytes, true),
    );

    const finalize$ = defer(async (): Promise<Either<Error, GrpcFileUploadResponse>> => {
      if (!context.isInitialized) {
        throw new BadRequestException('Stream closed before initialization');
      }

      // Wait for upload completion
      const isUploaded = await context.uploadPromise;

      if (!isUploaded) {
        throw new InternalServerErrorException('File upload failed');
      }

      if (context.processedBytes < context.totalBytes) {
        throw new InternalServerErrorException('File upload interrupted: size mismatch');
      }

      const file = context.file;

      if (!file) {
        throw new InternalServerErrorException('File entity dropped');
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
      return right({ entity: updatedFile.value });
    });

    return concat(acks$, finalize$).pipe(
      catchError(async (error) => {
        this.logger.error('File upload error:', error.message, error.stack);
        clearUpload(context.upload$);

        const file = context.file;

        if (file?.id) {
          await Promise.allSettled([
            this.persistenceService.isolatedRun(async () => {
              await this.updateById(file.id, {
                set: {
                  uploadStatus: GrpcFileUploadStatus.FAILED,
                },
              });
            }),
            firstValueFrom(this.natsClient.storage.file.deleteOne({ providerId: file.providerId })),
          ]);
        }

        return left(error);
      }),
      finalize(() => clearUpload(context.upload$)),
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

  async onDeleteOne(data: ProviderIdEvent): Promise<void> {
    await this.fileStorageService.deleteFile(data.providerId);
  }
}
