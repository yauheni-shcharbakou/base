import { DatabaseRunnerService } from '@backend/common';
import { StorageVideoEventBus } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { sendToWritable } from '@packages/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import {
  catchError,
  concat,
  concatMap,
  defer,
  finalize,
  Observable,
  takeWhile,
  tap,
  timeout,
} from 'rxjs';
import { PassThrough } from 'stream';

@Injectable()
export class VideoUploadOneUseCase {
  private readonly logger = new Logger(VideoUploadOneUseCase.name);

  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly storageVideoService: StorageVideoService,
    private readonly databaseRunnerService: DatabaseRunnerService,
    private readonly eventBus: StorageVideoEventBus,
  ) {}

  execute(
    request$: Observable<NestStorage.UploadOne>,
    userId?: string,
  ): Observable<Either<Error, NestStorage.VideoUploadResponse>> {
    type UploadContext = {
      video?: NestStorage.VideoPopulated;
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
      concatMap(async (message): Promise<Either<Error, NestStorage.VideoUploadResponse>> => {
        if (!context.isInitialized) {
          // initialization phase, find entity and start uploading to storage provider

          if (!userId) {
            throw new ForbiddenException(`User is required`);
          }

          if (!message.id) {
            throw new ConflictException('Video id should be provided before chunks');
          }

          const video = await this.databaseRunnerService.isolatedRun(async () => {
            return this.videoRepository.getOne<NestStorage.VideoPopulated>(
              { id: message.id, userId },
              { populate: ['file'] },
            );
          });

          if (video.isLeft()) {
            throw video.value;
          }

          context.video = video.value;

          if (context.video.file.uploadStatus === NestStorage.FileUploadStatus.READY) {
            throw new BadRequestException('File should have pending or failed upload status');
          }

          context.upload$ = new PassThrough({ highWaterMark: 0 });
          context.totalBytes = context.video.file.size;

          context.uploadPromise = this.storageVideoService.uploadVideo(
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

    const finalize$ = defer(async (): Promise<Either<Error, NestStorage.VideoUploadResponse>> => {
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

      const video = context.video;

      if (!video) {
        throw new InternalServerErrorException('Video entity dropped');
      }

      const { file, ...videoForSent } = video;
      await this.eventBus.emitUploadFinish(videoForSent);

      this.logger.log(`Video ${video.id} uploaded`);
      return right({ entity: _.omit(video, ['file']) });
    });

    return concat(acks$, finalize$).pipe(
      catchError(async (error) => {
        this.logger.error('Video upload error:', error.message, error.stack);
        clearUpload(context.upload$);

        const video = context.video;

        if (video?.id) {
          const { file, ...videoForSent } = video;

          await Promise.allSettled([
            this.eventBus.emitUploadFail(videoForSent),
            this.storageVideoService.deleteVideo(video.providerId),
          ]);
        }

        return left(error);
      }),
      finalize(() => clearUpload(context.upload$)),
    );
  }
}
