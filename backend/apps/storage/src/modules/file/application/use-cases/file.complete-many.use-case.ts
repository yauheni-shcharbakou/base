import { NestStorage } from '@backend/proto';
import { FileCompletionService } from '@modules/file/application/services/file.completion.service';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';

// Files completed at once: each costs a HEAD at Bunny, and a batch is up to a hundred of them.
const COMPLETION_CONCURRENCY = 10;

export type FileCompletion = {
  id: string;
  result: Either<Error, NestStorage.File>;
};

/**
 * Completes directly uploaded files in one call, each on its own: a file whose bytes have not
 * arrived yet fails alone, and the rest still turn READY. The answer holds one completion per
 * requested id, in request order, a repeated id answered alike.
 */
@Injectable()
export class FileCompleteManyUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly fileCompletionService: FileCompletionService,
  ) {}

  async execute({
    ids,
    userId,
  }: NestStorage.FileCompleteMany): Promise<Either<Error, FileCompletion[]>> {
    const uniqueIds = _.uniq(ids ?? []);

    if (!uniqueIds.length) {
      return left(new BadRequestException('No files to complete'));
    }

    // With `userId`, a file of another owner reads as missing, as `completeUpload`'s does.
    const files = _.keyBy(await this.fileRepository.getMany({ ids: uniqueIds, userId }), 'id');
    const results = new Map<string, Either<Error, NestStorage.File>>();

    for (const chunk of _.chunk(uniqueIds, COMPLETION_CONCURRENCY)) {
      await Promise.all(
        chunk.map(async (id) => {
          const file = files[id];

          results.set(
            id,
            file
              ? await this.fileCompletionService.complete(file)
              : left(new NotFoundException('File not found')),
          );
        }),
      );
    }

    return right(ids.map((id) => ({ id, result: results.get(id) })));
  }
}
