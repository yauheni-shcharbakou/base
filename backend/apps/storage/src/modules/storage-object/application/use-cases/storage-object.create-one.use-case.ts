import { NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import { StorageObjectValidationService } from '../services/storage-object.validation.service';

/**
 * Runs under the owner's tree lock, like every write that checks the tree first: the parent is
 * still a live folder of the owner, its `isPublic` is current and the name is still free when the
 * row lands. A leaf's media is the owner's own, so the same lock covers every other placement of
 * it: the media creates place under it too.
 */
@Injectable()
export class StorageObjectCreateOneUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly validationService: StorageObjectValidationService,
  ) {}

  async execute(
    createData: NestStorage.StorageObjectCreate,
  ): Promise<Either<Error, NestStorage.StorageObject>> {
    return this.storageObjectRepository.withTreeLock(createData.userId, async () => {
      const validated = await this.validationService.validateCreateData(createData);

      if (validated.isLeft()) {
        return left(validated.value);
      }

      return this.storageObjectRepository.saveOne(validated.value);
    });
  }
}
