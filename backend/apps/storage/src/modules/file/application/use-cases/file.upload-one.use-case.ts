import { DatabaseRunnerService } from '@backend/common';
import { StorageFileEventBus } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
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
export class FileUploadOneUseCase {
  private readonly logger = new Logger(FileUploadOneUseCase.name);

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageFileService: StorageFileService,
    private readonly databaseRunnerService: DatabaseRunnerService,
    private readonly eventBus: StorageFileEventBus,
  ) {}

  execute(
    request$: Observable<NestStorage.UploadOne>,
    userId?: string,
  ): Observable<Either<Error, NestStorage.FileUploadResponse>> {
    type UploadContext = {
      file?: NestStorage.File;
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
      concatMap(async (message): Promise<Either<Error, NestStorage.FileUploadResponse>> => {
        if (!context.isInitialized) {
          // initialization phase, find entity and start uploading to storage provider

          if (!userId) {
            throw new ForbiddenException(`User is required`);
          }

          if (!message.id) {
            throw new ConflictException('File id should be provided before chunks');
          }

          const file = await this.databaseRunnerService.isolatedRun(() => {
            return this.fileRepository.getOne({ id: message.id, userId });
          });

          if (file.isLeft()) {
            throw file.value;
          }

          context.file = file.value;

          if (!context.file.providerId) {
            throw new BadRequestException('File should have providerId');
          }

          if (context.file.uploadStatus === NestStorage.FileUploadStatus.READY) {
            throw new BadRequestException('File should have pending or failed upload status');
          }

          context.upload$ = new PassThrough({ highWaterMark: 0 });
          context.totalBytes = context.file.size;

          context.uploadPromise = this.storageFileService.uploadFile(
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

    const finalize$ = defer(async (): Promise<Either<Error, NestStorage.FileUploadResponse>> => {
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

      const updatedFile = await this.databaseRunnerService.isolatedRun(() => {
        return this.fileRepository.updateById(file.id, {
          set: {
            uploadStatus: NestStorage.FileUploadStatus.READY,
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
            this.databaseRunnerService.isolatedRun(async () => {
              await this.fileRepository.updateById(file.id, {
                set: {
                  uploadStatus: NestStorage.FileUploadStatus.FAILED,
                },
              });
            }),
            this.eventBus.emitDelete(file),
          ]);
        }

        return left(error);
      }),
      finalize(() => clearUpload(context.upload$)),
    );
  }
}
