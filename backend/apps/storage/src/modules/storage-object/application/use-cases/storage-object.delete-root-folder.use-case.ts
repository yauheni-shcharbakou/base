import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

/**
 * Marks a deleted user's root folder deleted, with the whole tree under it. Only the subtree mark
 * leaves nothing behind: a live object under a deleted root is shown by nothing and removed by no
 * cron. The rows go the way every deletion's do — the storage-object cleanup takes the emptied
 * folders bottom-up, the root last. The user's media are dropped by the file module on the same
 * event, independently of this.
 *
 * The caller is an at-least-once event handler, so a missing live root is success: a redelivery
 * finds it marked, or already removed by the cleanup.
 *
 * Runs under the owner's tree lock, like any deletion, so a create queued behind it is refused
 * instead of landing live in a tree that is being marked.
 */
@Injectable()
export class StorageObjectDeleteRootFolderUseCase {
  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  execute(userId: string): Promise<Either<Error, void>> {
    return this.storageObjectRepository.withTreeLock(userId, async () => {
      const root = await this.storageObjectRepository.getOne({
        userId,
        isFolder: true,
        isRoot: true,
        isDeleted: false,
      });

      if (root.isLeft()) {
        return root.value instanceof NotFoundException ? right(undefined) : left(root.value);
      }

      const marked = await this.storageObjectRepository.markDeletedWithDescendants(root.value.id);

      if (marked.isLeft()) {
        return left(marked.value);
      }

      return right(undefined);
    });
  }
}
