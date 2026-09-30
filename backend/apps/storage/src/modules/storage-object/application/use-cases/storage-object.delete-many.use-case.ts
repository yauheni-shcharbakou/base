import { NestStorage } from '@backend/proto';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

/**
 * Deletes several objects of one owner at once — each folder with its whole subtree — as
 * `StorageObjectDeleteOneUseCase` deletes one: by marking, under the owner's tree lock, with no
 * restore. All or none: a missing, deleted or foreign id, or the root folder among them, deletes
 * nothing. The marks are one statement over every subtree.
 */
@Injectable()
export class StorageObjectDeleteManyUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageObjectValidationService: StorageObjectValidationService,
  ) {}

  async execute({
    ids,
    userId,
  }: NestStorage.StorageObjectDeleteMany): Promise<Either<Error, NestStorage.StorageObject[]>> {
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

      // The root folder is the anchor of the user's tree, deleted only with its user.
      if (objects.value.some((object) => object.isFolder && !object.parentId)) {
        return left(new BadRequestException("You can't delete the root folder"));
      }

      const marked = await this.storageObjectRepository.markManyDeletedWithDescendants(
        objects.value.map(({ id }) => id),
      );

      if (marked.isLeft()) {
        return left(new InternalServerErrorException(marked.value.message));
      }

      return right(objects.value);
    });
  }
}
