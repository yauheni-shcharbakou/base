import { FileDropService } from '@modules/file/application/services/file.drop.service';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

// Rows per round trip; the purges go through the event bus, so the provider sees them at the
// queue's pace rather than all at once.
const BATCH_SIZE = 500;

/**
 * Drops every file of a deleted user — placed in the tree or not — and purges its provider object.
 * An image's and a video's backing file carries the owner, and the FK cascade takes the media row
 * and the storage-object leaf with it, so this covers all three kinds of media.
 *
 * The caller is an at-least-once event handler: a run that failed half-way is retried and picks up
 * whatever is left. Returns how many rows it dropped.
 */
@Injectable()
export class FileDeleteByOwnerUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly fileDropService: FileDropService,
  ) {}

  async execute(userId: string): Promise<Either<Error, number>> {
    let dropped = 0;

    try {
      for (;;) {
        const files = await this.fileRepository.getManyByOwner(userId, BATCH_SIZE);

        if (!files.length) {
          return right(dropped);
        }

        // `false` means a concurrent sweep took this batch first; the next read no longer sees it.
        if (await this.fileDropService.drop(files)) {
          dropped += files.length;
        }
      }
    } catch (error) {
      return left(error);
    }
  }
}
