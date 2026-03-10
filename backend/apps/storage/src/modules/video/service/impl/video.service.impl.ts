import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcFileUploadStatus,
  GrpcStorageObjectType,
  GrpcUrlMap,
  GrpcVideo,
  GrpcVideoCreate,
  GrpcVideoCreateRequest,
  GrpcVideoPopulated,
  GrpcVideoQuery,
  GrpcVideoUpdate,
  GrpcVideoUploadRequest,
  GrpcVideoUploadResponse,
} from '@backend/grpc';
import {
  BulkUpdate,
  CrudServiceImpl,
  PERSISTENCE_SERVICE,
  PersistenceService,
} from '@backend/persistence';
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
import { VIDEO_REPOSITORY, VideoRepository } from 'common/repositories/video/video.repository';
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
  finalize,
  firstValueFrom,
  from,
  ignoreElements,
  lastValueFrom,
  Observable,
  of,
  share,
  switchMap,
  take,
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
    @Inject(STORAGE_OBJECT_REPOSITORY)
    private readonly storageObjectRepository: StorageObjectRepository,
    @Inject(VIDEO_STORAGE_SERVICE) private readonly videoStorageService: VideoStorageService,
    @Inject(PERSISTENCE_SERVICE) private readonly persistenceService: PersistenceService,
  ) {
    super();
  }

  async deleteById(id: string): Promise<Either<NotFoundException, GrpcVideo>> {
    const video = await super.getById(id);

    if (video.isRight()) {
      await firstValueFrom(this.videoStorageService.deleteVideo(video.value.providerId));
    }

    return super.deleteById(id);
  }

  async getUrlMap(request: GrpcBaseQuery): Promise<GrpcUrlMap> {
    const videos = await this.repository.getMany(request);

    const items: GrpcUrlMap['items'] = {};

    await Promise.all(
      _.map(videos, async (video) => {
        const url = await this.videoStorageService.getPlayerUrl(video.providerId);

        if (url.isRight()) {
          items[video.id] = url.value;
        }
      }),
    );

    return { items };
  }

  async getDownloadMap(request: GrpcBaseQuery): Promise<GrpcDownloadMap> {
    const videos = await this.repository.getMany<GrpcVideoPopulated>(request, {
      populate: ['file'],
    });

    const items: GrpcDownloadMap['items'] = {};

    await Promise.all(
      _.map(videos, async (video) => {
        const url = await this.videoStorageService.getDownloadUrl(video.providerId);

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
    const file = await this.fileRepository.saveOne({ ...request.file, userId });

    if (file.isLeft()) {
      return left(file.value);
    }

    revertHooks.push(() => this.fileRepository.deleteById(file.value.id));

    const providerId = await firstValueFrom(this.videoStorageService.createVideo(request.video));

    if (providerId.isLeft()) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return left(providerId.value);
    }

    revertHooks.push(() => firstValueFrom(this.videoStorageService.deleteVideo(providerId.value)));

    const video = await this.repository.saveOne({
      ...request.video,
      userId,
      file: file.value.id,
      providerId: providerId.value,
    });

    if (video.isLeft()) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return video;
    }

    if (!request.storage) {
      return video;
    }

    revertHooks.push(() => this.repository.deleteById(video.value.id));

    const storage = await this.storageObjectRepository.saveOne({
      ...request.storage,
      userId,
      file: file.value.id,
      video: video.value.id,
      type: GrpcStorageObjectType.VIDEO,
    });

    if (storage.isLeft()) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return left(storage.value);
    }

    return video;
  }

  uploadOne(
    request$: Observable<GrpcVideoUploadRequest>,
    userId?: string,
  ): Observable<Either<Error, GrpcVideoUploadResponse>> {
    const sharedRequest$ = request$.pipe(share());

    type Params = {
      video: GrpcVideoPopulated;
      upload$: PassThrough;
      uploadPromise: Promise<boolean>;
    };

    let uploadedVideo: GrpcVideoPopulated;

    return sharedRequest$.pipe(
      take(1),
      timeout(5_000),
      switchMap(async (message): Promise<Params> => {
        if (!userId) {
          throw new ForbiddenException(`User is required`);
        }

        if (!message.video) {
          throw new ConflictException('Video id should be provided before chunks');
        }

        const video = await this.persistenceService.isolatedRun(async () => {
          return this.repository.getOne<GrpcVideoPopulated>(
            { id: message.video, userId },
            { populate: ['file'] },
          );
        });

        if (video.isLeft()) {
          throw video.value;
        }

        uploadedVideo = video.value;

        if (uploadedVideo.file.uploadStatus === GrpcFileUploadStatus.READY) {
          throw new BadRequestException('File should have pending or failed upload status');
        }

        const upload$ = new PassThrough();

        const uploadPromise = firstValueFrom(
          this.videoStorageService.uploadVideo(
            uploadedVideo.providerId,
            uploadedVideo.file.size,
            upload$,
          ),
        );

        uploadPromise.catch(() => {});

        return { video: uploadedVideo, upload$, uploadPromise };
      }),
      switchMap(
        ({ video, upload$, uploadPromise }): Observable<Either<Error, GrpcVideoUploadResponse>> => {
          let totalBytes = 0;

          const initialResponse = of(right({ canSendChunks: true }));

          const chunkProcessor$ = sharedRequest$.pipe(
            timeout(10_000),
            concatMap(async (message): Promise<number> => {
              if (!message.chunk) {
                throw new ConflictException('Only chunks should be provided after video id');
              }

              await sendToWritable(upload$, Buffer.from(message.chunk));
              totalBytes += message.chunk.length;
              return (totalBytes / uploadedVideo.file.size) * 100;
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
                throw new InternalServerErrorException('Video upload failed');
              }

              if (totalBytes < uploadedVideo.file.size) {
                throw new InternalServerErrorException('Video upload interrupted: size mismatch');
              }

              const updatedFile = await this.persistenceService.isolatedRun(async () => {
                return this.fileRepository.updateById(uploadedVideo.file.id, {
                  set: {
                    uploadStatus: GrpcFileUploadStatus.READY,
                  },
                });
              });

              if (updatedFile.isLeft()) {
                throw updatedFile.value;
              }

              this.logger.log(`Video ${video.id} uploaded`);
              return right({ video });
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
        this.logger.error('Video upload error:', err.message, err.stack);

        if (uploadedVideo?.id) {
          await Promise.allSettled([
            this.persistenceService.isolatedRun(async () => {
              await this.fileRepository.updateById(uploadedVideo.file.id, {
                set: {
                  uploadStatus: GrpcFileUploadStatus.FAILED,
                },
              });
            }),
            firstValueFrom(this.videoStorageService.deleteVideo(uploadedVideo.providerId)),
          ]);
        }

        return left(err);
      }),
    );
  }

  async updateById(
    id: string,
    updateData: GrpcVideoUpdate,
  ): Promise<Either<NotFoundException, GrpcVideo>> {
    if (updateData.set) {
      const video = await this.repository.getById(id);

      if (video.isLeft()) {
        return video;
      }

      const updateResult = await lastValueFrom(
        this.videoStorageService.updateVideo(video.value.providerId, updateData.set),
      );

      if (updateResult.isLeft()) {
        return left(updateResult.value as NotFoundException);
      }
    }

    return super.updateById(id, updateData);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updateVideos() {
    try {
      await this.persistenceService.isolatedRun(async () => {
        let page = 1;
        let hasNext = true;
        const limit = 100;

        do {
          const { items, total } = await firstValueFrom(
            this.videoStorageService.getList(page, limit),
          );

          await this.repository.bulkUpdate(
            _.map(items, (item): BulkUpdate<GrpcVideo> => {
              return {
                filter: {
                  key: 'providerId',
                  value: item.providerId,
                },
                update: {
                  duration: item.duration,
                  views: item.views,
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
}
