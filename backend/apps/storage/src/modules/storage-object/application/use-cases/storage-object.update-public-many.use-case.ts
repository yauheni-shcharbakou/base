import { NestStorage } from '@backend/proto';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

/**
 * Makes several objects of one owner public or private, by the rules of a single visibility change
 * (`StorageObjectUpdateOneUseCase`): a folder writes its new value over its whole subtree, and an
 * object in a public folder is not made private — unless that folder is made private by the same
 * call.
 *
 * One transaction under the owner's tree lock, so all or none. An object that already has the value
 * is left as it is. Returns every named object, in the order given.
 */
@Injectable()
export class StorageObjectUpdatePublicManyUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageObjectValidationService: StorageObjectValidationService,
  ) {}

  async execute({
    ids,
    isPublic,
    userId,
  }: NestStorage.StorageObjectUpdatePublicMany): Promise<
    Either<Error, NestStorage.StorageObject[]>
  > {
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

      const visibility = await this.storageObjectValidationService.validateVisibility(
        objects.value,
        isPublic,
      );

      if (visibility.isLeft()) {
        return left(visibility.value);
      }

      const updated: NestStorage.StorageObject[] = [];

      for (const object of objects.value) {
        if (object.isPublic === isPublic) {
          updated.push(object);
          continue;
        }

        const written = await this.storageObjectRepository.updateAndCascadePublic(object.id, {
          set: { isPublic },
        });

        if (written.isLeft()) {
          return left(written.value);
        }

        updated.push(written.value);
      }

      return right(updated);
    });
  }
}
