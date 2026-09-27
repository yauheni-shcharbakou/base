import { FileDeleteByOwnerUseCase } from '@modules/file/application/use-cases/file.delete-by-owner.use-case';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageObjectDeleteRootFolderUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-root-folder.use-case';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { UserDirectoryService } from '@modules/user/domain/services/user-directory.service';
import { Injectable, Logger } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';

// Owner ids per call to auth.
const BATCH_SIZE = 500;

/**
 * The backstop for a lost `auth.user.delete`: an emit that failed after the user row was gone, or a
 * root folder a retried `auth.user.create` wrote after the delete. Asks auth which of the users
 * still holding data here exist, and runs the event's two halves — mark the tree, drop the media —
 * for every one that does not. Both halves are idempotent, so a user the event did reach costs
 * nothing.
 *
 * An auth that reports no users at all is refused rather than trusted: pointed at the wrong
 * database, it would otherwise have every user's data dropped. Returns how many users it purged.
 */
@Injectable()
export class UserPurgeDeletedUseCase {
  private readonly logger = new Logger(UserPurgeDeletedUseCase.name);

  constructor(
    private readonly userDirectoryService: UserDirectoryService,
    private readonly fileRepository: FileRepository,
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly deleteRootFolderUseCase: StorageObjectDeleteRootFolderUseCase,
    private readonly fileDeleteByOwnerUseCase: FileDeleteByOwnerUseCase,
  ) {}

  async execute(): Promise<Either<Error, number>> {
    const userCount = await this.userDirectoryService.count();

    if (userCount.isLeft()) {
      return left(userCount.value);
    }

    if (userCount.value === 0) {
      return left(new Error('Auth reports no users at all; refusing to purge every owner'));
    }

    const ownerIds = _.union(
      await this.fileRepository.getOwnerIds(),
      await this.storageObjectRepository.getLiveOwnerIds(),
    );

    let purged = 0;

    for (const batch of _.chunk(ownerIds, BATCH_SIZE)) {
      const existing = await this.userDirectoryService.getExistingIds(batch);

      if (existing.isLeft()) {
        return left(existing.value);
      }

      for (const userId of batch) {
        if (!existing.value.has(userId) && (await this.purge(userId))) {
          purged += 1;
        }
      }
    }

    return right(purged);
  }

  // One user failing does not stop the others; whatever is left is picked up next run.
  private async purge(userId: string): Promise<boolean> {
    const tree = await this.deleteRootFolderUseCase.execute(userId);
    const media = await this.fileDeleteByOwnerUseCase.execute(userId);

    for (const result of [tree, media]) {
      if (result.isLeft()) {
        this.logger.error(`Failed to purge the data of deleted user ${userId}`, result.value);
        return false;
      }
    }

    this.logger.log(`Purged the data of deleted user ${userId}`);
    return true;
  }
}
