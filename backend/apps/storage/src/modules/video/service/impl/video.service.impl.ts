import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcFileUploadStatus,
  GrpcStorageObjectType,
  GrpcUploadRequest,
  GrpcUrlMap,
  GrpcVideo,
  GrpcVideoCreate,
  GrpcVideoCreateManyItem,
  GrpcVideoCreateManyRequest,
  GrpcVideoCreateManyResponse,
  GrpcVideoCreateRequest,
  GrpcVideoPopulated,
  GrpcVideoQuery,
  GrpcVideoUpdate,
  GrpcVideoUploadResponse,
} from '@backend/grpc';
import {
  BulkUpdate,
  CrudServiceImpl,
  PERSISTENCE_SERVICE,
  PersistenceService,
} from '@backend/persistence';
import {
  InjectNatsClient,
  NatsClient,
  ProviderIdEvent,
  VideoUpdateOneEvent,
} from '@backend/transport';
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
  VIDEO_REPOSITORY,
  VideoCreate,
  VideoRepository,
} from 'common/repositories/video/video.repository';
import {
  STORAGE_OBJECT_SERVICE,
  StorageObjectService,
} from 'common/services/storage-object/storage-object.service';
import {
  VIDEO_STORAGE_SERVICE,
  VideoStorageService,
} from 'common/services/video-storage/video-storage.service';
import _ from 'lodash';
import { VideoService } from 'modules/video/service/video.service';
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

export class VideoServiceImpl
  extends CrudServiceImpl<GrpcVideo, GrpcVideoQuery, GrpcVideoCreate, GrpcVideoUpdate>
  implements VideoService
{
  private readonly logger = new Logger(VideoServiceImpl.name);

  constructor(
    @Inject(VIDEO_REPOSITORY) protected readonly repository: VideoRepository,
    @Inject(FILE_REPOSITORY) protected readonly fileRepository: FileRepository,
    @Inject(VIDEO_STORAGE_SERVICE) private readonly videoStorageService: VideoStorageService,
    @Inject(STORAGE_OBJECT_SERVICE)
    private readonly storageObjectService: StorageObjectService,
    @Inject(PERSISTENCE_SERVICE) private readonly persistenceService: PersistenceService,
    @InjectNatsClient() private readonly natsClient: NatsClient,
  ) {
    super();
  }

  async deleteById(id: string): Promise<Either<NotFoundException, GrpcVideo>> {
    const video = await this.repository.getById<GrpcVideoPopulated>(id, { populate: ['file'] });

    if (video.isLeft()) {
      return video;
    }

    const deletedVideo = await super.deleteById(id);

    if (deletedVideo.isRight() && video.value.file.uploadStatus === GrpcFileUploadStatus.READY) {
      await firstValueFrom(
        this.natsClient.storage.video.deleteOne({ providerId: video.value.providerId }),
      );
    }

    return deletedVideo;
  }

  async getUrlMap(request: GrpcBaseQuery, ip?: string): Promise<GrpcUrlMap> {
    const videos = await this.repository.getMany(request);

    const items: GrpcUrlMap['items'] = {};

    await Promise.all(
      _.map(videos, async (video) => {
        const url = await this.videoStorageService.getPlayerUrl(video.providerId, ip);

        if (url.isRight()) {
          items[video.id] = url.value;
        }
      }),
    );

    return { items };
  }

  async getDownloadMap(request: GrpcBaseQuery, ip?: string): Promise<GrpcDownloadMap> {
    const videos = await this.repository.getMany<GrpcVideoPopulated>(request, {
      populate: ['file'],
    });

    const items: GrpcDownloadMap['items'] = {};

    await Promise.all(
      _.map(videos, async (video) => {
        const url = await this.videoStorageService.getDownloadUrl(video.providerId, ip);

        if (url.isRight()) {
          items[video.id] = {
            url: url.value,
            fileName: `${video.id}.${video.file.extension}`,
          };
        }
      }),
    );

    return { items };
  }

  async createOne(
    request: GrpcVideoCreateRequest,
    userId: string,
  ): Promise<Either<Error, GrpcVideo>> {
    const revertHooks: (() => Promise<any>)[] = [];

    const providerId = await this.videoStorageService.createVideo({ ...request.video, userId });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const file = await this.fileRepository.saveOne({
      ...request.file,
      userId,
      uploadId: providerId.value,
    });

    if (file.isLeft()) {
      return left(file.value);
    }

    revertHooks.push(() => this.fileRepository.deleteById(file.value.id));

    const video = await this.repository.saveOne({
      ...request.video,
      userId,
      file: file.value.id,
      providerId: providerId.value,
      uploadId: providerId.value,
    });

    if (video.isLeft()) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return video;
    }

    if (!request.storage) {
      return video;
    }

    revertHooks.push(() => this.repository.deleteById(video.value.id));

    const storage = await this.storageObjectService.createOne(
      {
        ...request.storage,
        type: GrpcStorageObjectType.VIDEO,
        file: video.value.fileId,
        video: video.value.id,
      },
      userId,
    );

    if (storage.isLeft()) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return left(storage.value);
    }

    return video;
  }

  async createMany(
    request: GrpcVideoCreateManyRequest,
    userId: string,
  ): Promise<Either<Error, GrpcVideoCreateManyResponse>> {
    const fileNames = new Set(_.map(request.items, 'file.originalName'));

    if (fileNames.size !== request.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    const revertHooks: (() => Promise<any>)[] = [];

    try {
      const dataByUploadId = new Map<string, GrpcVideoCreateManyItem>();
      const providerIdByUploadId = new Map<string, string>();

      const fileData: FileCreate[] = await Promise.all(
        _.map(request.items, async (item) => {
          dataByUploadId.set(item.uploadId, item);

          const providerId = await this.videoStorageService.createVideo({
            ...item.video,
            userId,
          });

          if (providerId.isLeft()) {
            throw providerId.value;
          }

          providerIdByUploadId.set(item.uploadId, providerId.value);

          return { ...item.file, userId, uploadId: item.uploadId };
        }),
      );

      const files = await this.fileRepository.saveMany(fileData);

      if (files.isLeft()) {
        return left(files.value);
      }

      revertHooks.push(() => this.fileRepository.deleteMany({ ids: _.map(files.value, 'id') }));

      const videoData: VideoCreate[] = _.map(files.value, (file) => {
        const data = dataByUploadId.get(file.uploadId);
        const providerId = providerIdByUploadId.get(file.uploadId);

        return {
          ...data.video,
          file: file.id,
          userId,
          providerId,
          uploadId: file.uploadId,
        };
      });

      const videos = await this.repository.saveMany(videoData);

      if (videos.isLeft()) {
        await Promise.all(_.map(revertHooks, (hook) => hook()));
        return left(videos.value);
      }

      const videoByFileId = new Map(_.map(videos.value, (video) => [video.fileId, video]));

      revertHooks.push(() => this.repository.deleteMany({ ids: _.map(videos.value, 'id') }));

      if (request.storage) {
        const storage = await this.storageObjectService.createManyFiles({
          ...request.storage,
          userId,
          files: _.map(files.value, (file) => {
            return {
              file: file.id,
              video: videoByFileId.get(file.id)?.id,
              name: file.originalName,
              type: GrpcStorageObjectType.VIDEO,
            };
          }),
        });

        if (storage.isLeft()) {
          await Promise.all(_.map(revertHooks, (hook) => hook()));
          return left(storage.value);
        }
      }

      return right({ items: videos.value });
    } catch (error) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return left(error);
    }
  }

  uploadOne(
    request$: Observable<GrpcUploadRequest>,
    userId?: string,
  ): Observable<Either<Error, GrpcVideoUploadResponse>> {
    type UploadContext = {
      video?: GrpcVideoPopulated;
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
      concatMap(async (message): Promise<Either<Error, GrpcVideoUploadResponse>> => {
        if (!context.isInitialized) {
          // initialization phase, find entity and start uploading to storage provider

          if (!userId) {
            throw new ForbiddenException(`User is required`);
          }

          if (!message.id) {
            throw new ConflictException('Video id should be provided before chunks');
          }

          const video = await this.persistenceService.isolatedRun(async () => {
            return this.repository.getOne<GrpcVideoPopulated>(
              { id: message.id, userId },
              { populate: ['file'] },
            );
          });

          if (video.isLeft()) {
            throw video.value;
          }

          context.video = video.value;

          if (context.video.file.uploadStatus === GrpcFileUploadStatus.READY) {
            throw new BadRequestException('File should have pending or failed upload status');
          }

          context.upload$ = new PassThrough({ highWaterMark: 0 });
          context.totalBytes = context.video.file.size;

          context.uploadPromise = this.videoStorageService.uploadVideo(
            context.video.providerId,
            context.totalBytes,
            context.upload$,
          );

          context.uploadPromise.catch(() => {});
          context.isInitialized = true;
          return right({ canSendChunks: true }); // client signal for starting file streaming
        }

        // chunks processing phase

        if (!message.chunk) {
          throw new ConflictException('Only chunks should be provided after video id');
        }

        const chunk = Buffer.from(message.chunk);
        delete message.chunk;

        await sendToWritable(context.upload$, chunk);
        context.processedBytes += chunk.length;
        return right({ ack: true }); // client signal for sending next chunk
      }),
      takeWhile(() => !context.isInitialized || context.processedBytes < context.totalBytes, true),
    );

    const finalize$ = defer(async (): Promise<Either<Error, GrpcVideoUploadResponse>> => {
      if (!context.isInitialized) {
        throw new BadRequestException('Stream closed before initialization');
      }

      // Wait for upload completion
      const isUploaded = await context.uploadPromise;

      if (!isUploaded) {
        throw new InternalServerErrorException('Video upload failed');
      }

      if (context.processedBytes < context.totalBytes) {
        throw new InternalServerErrorException('Video upload interrupted: size mismatch');
      }

      const updatedFile = await this.persistenceService.isolatedRun(async () => {
        return this.fileRepository.updateById(context.video.file.id, {
          set: {
            uploadStatus: GrpcFileUploadStatus.READY,
          },
        });
      });

      if (updatedFile.isLeft()) {
        throw updatedFile.value;
      }

      this.logger.log(`Video ${context.video.id} uploaded`);
      return right({ entity: _.omit(context.video, ['file']) });
    });

    return concat(acks$, finalize$).pipe(
      catchError(async (error) => {
        this.logger.error('Video upload error:', error.message, error.stack);
        clearUpload(context.upload$);

        const video = context.video;

        if (video?.id) {
          await Promise.allSettled([
            this.persistenceService.isolatedRun(async () => {
              await this.fileRepository.updateById(video.file.id, {
                set: { uploadStatus: GrpcFileUploadStatus.FAILED },
              });
            }),
            firstValueFrom(
              this.natsClient.storage.video.deleteOne({ providerId: video.providerId }),
            ),
          ]);
        }

        return left(error);
      }),
      finalize(() => clearUpload(context.upload$)),
    );
  }

  async updateById(
    id: string,
    updateData: GrpcVideoUpdate,
  ): Promise<Either<NotFoundException, GrpcVideo>> {
    const video = await super.updateById(id, updateData);

    if (video.isRight() && updateData.set) {
      await firstValueFrom(
        this.natsClient.storage.video.updateOne({
          providerId: video.value.providerId,
          update: updateData.set,
        }),
      );
    }

    return video;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updateVideos() {
    try {
      await this.persistenceService.isolatedRun(async () => {
        let page = 1;
        let hasNext = true;
        const limit = 100;

        do {
          const { items, total } = await this.videoStorageService.getList(page, limit);

          await this.repository.bulkUpdate(
            _.map(items, (item): BulkUpdate<GrpcVideo> => {
              return {
                filter: {
                  key: 'providerId',
                  value: item.providerId,
                },
                update: {
                  set: {
                    duration: item.duration,
                    views: item.views,
                  },
                },
              };
            }),
          );

          hasNext = page * limit < total;
          page += 1;
        } while (hasNext);
      });
    } catch (error) {
      this.logger.error('Update videos error:', error.message, error.stack);
    }
  }

  async onDeleteOne(data: ProviderIdEvent): Promise<void> {
    await this.videoStorageService.deleteVideo(data.providerId);
  }

  async onUpdateOne(data: VideoUpdateOneEvent): Promise<void> {
    await this.videoStorageService.updateVideo(data.providerId, data.update);
  }
}
