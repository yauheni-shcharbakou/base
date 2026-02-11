import { GrpcFile, GrpcFileUpload } from '@backend/grpc';
import { Inject, Logger } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { FILE_REPOSITORY, FileRepository } from 'common/repositories/file/file.repository';
import { FileService } from 'modules/file/service/file.service';
import { WriteStream, createWriteStream } from 'fs';
import { existsSync, unlinkSync } from 'node:fs';
import { catchError, concatMap, filter, finalize, map, Observable, of, take, timeout } from 'rxjs';
import { join } from 'path';
import { extname } from 'node:path';
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

  constructor(@Inject(FILE_REPOSITORY) private readonly fileRepository: FileRepository) {}

  uploadOne(stream$: Observable<GrpcFileUpload>): Observable<Either<Error, GrpcFile>> {
    let writeStream: WriteStream;
    let createdFile: GrpcFile;
    let isSuccess = false;
    let filePath: string;

    return stream$.pipe(
      timeout(10_000),
      concatMap(async (message): Promise<MessageResult> => {
        if (message.create) {
          const file = await this.fileRepository.saveOne(message.create);

          if (file.isLeft()) {
            throw file.value;
          }

          createdFile = file.value;

          filePath = join(
            process.cwd(),
            'uploads',
            `${createdFile.id + extname(createdFile.originalName)}`,
          );

          writeStream = createWriteStream(filePath);
          return { phase: 'create', file: createdFile };
        }

        if (message.chunk && writeStream) {
          const buffer = Buffer.from(message.chunk);

          return new Promise((resolve, reject) => {
            const canWrite = writeStream.write(buffer, (err) => {
              if (err) {
                reject(err);
              }

              if (canWrite) {
                resolve({ phase: 'chunk' });
              }
            });

            if (!canWrite) {
              writeStream.once('drain', () => resolve({ phase: 'chunk' }));
            }
          });
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

        if (writeStream) {
          await new Promise((resolve, reject) => {
            writeStream.end((err?: Error) => (err ? reject(err) : resolve(null)));
          });
        }

        isSuccess = true;
        this.logger.log(`File ${createdFile.id} uploaded`);
        return right(createdFile);
      }),
      catchError((err) => {
        this.logger.error('File upload error:', err.message, err.stack);
        const errorResult = left(err);

        if (!createdFile?.id) {
          return of(errorResult);
        }

        return fromPromise(this.fileRepository.deleteById(createdFile.id)).pipe(
          map(() => errorResult),
        );
      }),
      finalize(() => {
        if (writeStream && !writeStream.destroyed) {
          writeStream.destroy();
        }

        if (!isSuccess && createdFile && filePath && existsSync(filePath)) {
          try {
            unlinkSync(filePath);
          } catch (e) {}
        }
      }),
    );
  }
}
