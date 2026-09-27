import { NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

/**
 * Deletes a folder or a leaf by marking it — and, for a folder, everything under it — deleted. That
 * hides it from the tree at once; the rows, and the objects at the provider, are removed later by
 * the cleanup crons: the file cleanup takes the media under a deleted storage object (the leaf row
 * goes with its file through the FK cascade), the storage-object cleanup takes the emptied folders.
 * No restore — the mark exists so a large folder is deleted in one statement, not to be undone.
 *
 * Runs under the owner's tree lock, like a move. Otherwise an object moved out of the folder while
 * the mark runs could still be marked from the subtree the mark read, one moved in could escape it,
 * and one created in it could stay live under a deleted folder, where nothing ever shows or removes
 * it.
 */
@Injectable()
export class StorageObjectDeleteOneUseCase {
  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  async execute(
    query: Partial<NestStorage.StorageObjectQuery>,
  ): Promise<Either<Error, NestStorage.StorageObject>> {
    const liveQuery = { ...query, isDeleted: false };

    // Read once before the lock only to learn whose tree to lock — an owner never changes.
    const owner = await this.storageObjectRepository.getOne(liveQuery);

    if (owner.isLeft()) {
      return left(owner.value);
    }

    return this.storageObjectRepository.withTreeLock(owner.value.userId, async () => {
      const entity = await this.storageObjectRepository.getOne(liveQuery);

      if (entity.isLeft()) {
        return left(entity.value);
      }

      // The root folder is the anchor of the user's tree — every placement resolves through it, so
      // it is not deletable. It is the only folder without a parent.
      if (entity.value.isFolder && !entity.value.parentId) {
        return left(new BadRequestException("You can't delete the root folder"));
      }

      const marked = await this.storageObjectRepository.markDeletedWithDescendants(entity.value.id);

      if (marked.isLeft()) {
        return left(new InternalServerErrorException(marked.value.message));
      }

      return right(entity.value);
    });
  }
}
