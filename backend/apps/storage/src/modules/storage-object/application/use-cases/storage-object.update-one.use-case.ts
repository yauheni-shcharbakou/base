import { NestStorage } from '@backend/proto';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import {
  StorageObjectRepository,
  StorageObjectUpdate,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { StorageObjectValidationService } from '../services/storage-object.validation.service';

/**
 * Nothing about a folder's path has to follow a move or a rename: `folderPath` is derived from the
 * tree on read. Only `isPublic` is stored per row, and the repository writes a folder's new value
 * over its subtree in the same transaction as the folder itself.
 *
 * An object moves only within its owner's tree — the new parent must be the owner's own live
 * folder, whoever makes the call, an admin included. A move lands under a free name (` (n)` on a
 * clash); a rename in place is refused with a 409 on a taken name.
 *
 * The whole read-check-write runs under the owner's tree lock. Without it, two opposite moves
 * (A into B, B into A) each pass the descendant check before either commits, and together close a
 * cycle. A move also reads its new parent's `isPublic` after any visibility change queued before it.
 */
@Injectable()
export class StorageObjectUpdateOneUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageObjectValidationService: StorageObjectValidationService,
  ) {}

  private async transformUpdate(
    entity: StorageObject,
    updateData: NestStorage.StorageObjectUpdate,
  ): Promise<Either<Error, StorageObjectUpdate>> {
    const update: StorageObjectUpdate = {
      set: _.pick(updateData.set ?? {}, ['isPublic']),
    };

    if (updateData.set?.parent) {
      if (entity.isFolder) {
        const childrenIds = await this.storageObjectRepository.getAllChildrenIds(entity.id);

        if (childrenIds.isLeft()) {
          return left(childrenIds.value);
        }

        if (childrenIds.value.has(updateData.set.parent)) {
          return left(new BadRequestException('Invalid parent'));
        }
      }

      const placeData = await this.storageObjectValidationService.validatePlacement(
        updateData.set.parent,
        entity.userId,
        entity.id,
      );

      if (placeData.isLeft()) {
        return left(placeData.value);
      }

      update.set.parent = updateData.set.parent;
      update.set.isPublic = placeData.value.isPublic;
    }

    // An empty name or parent means "unchanged", like an absent one.
    const name = updateData.set?.name || entity.name;
    const parent = updateData.set?.parent || entity.parentId;
    let resolvedName = name;

    if (parent && parent !== entity.parentId) {
      // A move lands under a free name, suffixed on a clash, as a batch move and an upload do.
      resolvedName = await this.storageObjectValidationService.resolveFreeName({
        id: entity.id,
        userId: entity.userId,
        name,
        parent,
        isFolder: entity.isFolder,
      });
    } else if (parent && name !== entity.name) {
      // A rename in place applies the name it was given or fails. Nothing to check for a root
      // folder, which has no folder to clash in.
      const freeName = await this.storageObjectValidationService.validateNameIsFree({
        id: entity.id,
        userId: entity.userId,
        name,
        parent,
      });

      if (freeName.isLeft()) {
        return left(freeName.value);
      }
    }

    if (resolvedName !== entity.name) {
      update.set.name = resolvedName;
    }

    return right(update);
  }

  async execute(
    query: NestStorage.StorageObjectQuery,
    updateData: NestStorage.StorageObjectUpdate,
  ): Promise<Either<Error, NestStorage.StorageObject>> {
    // A deleted object is hidden and waits for the cleanup; it is not edited, moved back into a
    // live folder included.
    const liveQuery = { ...query, isDeleted: false };

    // Read once before the lock only to learn whose tree to lock — an owner never changes, so the
    // value cannot go stale. Everything else is read again under the lock.
    const owner = await this.storageObjectRepository.getOne(liveQuery);

    if (owner.isLeft()) {
      return left(owner.value);
    }

    return this.storageObjectRepository.withTreeLock(owner.value.userId, async () => {
      const storageObject = await this.storageObjectRepository.getOne(liveQuery);

      if (storageObject.isLeft()) {
        return left(storageObject.value);
      }

      const update = await this.transformUpdate(storageObject.value, updateData);

      if (update.isLeft()) {
        return left(update.value);
      }

      return this.storageObjectRepository.updateAndCascadePublic(
        storageObject.value.id,
        update.value,
      );
    });
  }
}
