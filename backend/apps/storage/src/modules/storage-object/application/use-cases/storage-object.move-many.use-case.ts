import { NestStorage } from '@backend/proto';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import {
  StorageObjectRepository,
  StorageObjectUpdate,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

/**
 * Moves several objects of one owner into one of the owner's folders, by the rules of a single move
 * (`StorageObjectUpdateOneUseCase`): the new parent's `isPublic` spreads over each moved subtree, no
 * folder goes into its own subtree, and a name taken in the target gets a ` (n)` suffix.
 *
 * One transaction under the owner's tree lock, so all or none. The objects are written one after
 * the other in the order given, and each name is resolved after the ones before it landed, so the
 * batch cannot clash with itself. An object already in the target stays as it is. Returns every
 * named object, under the name it ended up with.
 */
@Injectable()
export class StorageObjectMoveManyUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageObjectValidationService: StorageObjectValidationService,
  ) {}

  async execute({
    ids,
    parent,
    userId,
  }: NestStorage.StorageObjectMoveMany): Promise<Either<Error, NestStorage.StorageObject[]>> {
    // Read once before the lock only to learn whose tree to lock — an owner never changes.
    const owned = await this.storageObjectValidationService.validateBatch(ids, userId);

    if (owned.isLeft()) {
      return left(owned.value);
    }

    return this.storageObjectRepository.withTreeLock(owned.value[0].userId, async () => {
      const objects = await this.storageObjectValidationService.validateBatch(ids, userId);

      if (objects.isLeft()) {
        return left(objects.value);
      }

      const placement = await this.storageObjectValidationService.validatePlacement(
        parent,
        objects.value[0].userId,
      );

      if (placement.isLeft()) {
        return left(placement.value);
      }

      const isInsideMoved = await this.isInsideMovedFolders(parent, objects.value);

      if (isInsideMoved.isLeft()) {
        return left(isInsideMoved.value);
      }

      if (isInsideMoved.value) {
        return left(new BadRequestException('Invalid parent'));
      }

      const moved: NestStorage.StorageObject[] = [];

      for (const object of objects.value) {
        if (object.parentId === parent) {
          moved.push(object);
          continue;
        }

        const name = await this.storageObjectValidationService.resolveFreeName({
          id: object.id,
          userId: object.userId,
          name: object.name,
          parent,
          isFolder: object.isFolder,
        });

        const update: StorageObjectUpdate = {
          set: {
            parent,
            isPublic: placement.value.isPublic,
            ...(name !== object.name ? { name } : {}),
          },
        };

        const written = await this.storageObjectRepository.updateAndCascadePublic(
          object.id,
          update,
        );

        if (written.isLeft()) {
          return left(written.value);
        }

        moved.push(written.value);
      }

      return right(moved);
    });
  }

  // The target is one of the moved folders or under one: the move would detach it from the root
  // and close a cycle.
  private async isInsideMovedFolders(
    parent: string,
    objects: StorageObject[],
  ): Promise<Either<Error, boolean>> {
    for (const object of objects) {
      if (object.id === parent) {
        return right(true);
      }

      if (!object.isFolder) {
        continue;
      }

      const childrenIds = await this.storageObjectRepository.getAllChildrenIds(object.id);

      if (childrenIds.isLeft()) {
        return left(childrenIds.value);
      }

      if (childrenIds.value.has(parent)) {
        return right(true);
      }
    }

    return right(false);
  }
}
