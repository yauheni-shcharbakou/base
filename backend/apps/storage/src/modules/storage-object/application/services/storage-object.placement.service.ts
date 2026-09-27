import { StorageObjectPlacementMeta } from '@common/domain/interfaces/storage-object.meta.interface';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import {
  StorageObjectLeavesRequest,
  StorageObjectValidationService,
} from './storage-object.validation.service';

/**
 * How the media modules put what they create into a user's tree. The folder check, the names and
 * the insert run in one transaction under the owner's tree lock, so a create cannot land in a
 * folder that a deletion queued ahead of it has just marked, keep an `isPublic` a visibility change
 * has just replaced, or take a name a concurrent create has just taken.
 *
 * Only database work belongs in `save`: every create of the same owner waits while it runs.
 */
@Injectable()
export class StorageObjectPlacementService {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly validationService: StorageObjectValidationService,
  ) {}

  /**
   * Calls `save` with one placement per requested name, in order — or with none, and without the
   * lock, when nothing is placed. Repository calls inside `save` join the lock's transaction; a
   * `left` rolls it back.
   */
  placeLeaves<T>(
    request: StorageObjectLeavesRequest | undefined,
    save: (leaves?: StorageObjectPlacementMeta[]) => Promise<Either<Error, T>>,
  ): Promise<Either<Error, T>> {
    if (!request) {
      return save();
    }

    return this.storageObjectRepository.withTreeLock(request.userId, async () => {
      const leaves = await this.validationService.validateLeaves(request);

      if (leaves.isLeft()) {
        return left(leaves.value);
      }

      return save(leaves.value);
    });
  }
}
