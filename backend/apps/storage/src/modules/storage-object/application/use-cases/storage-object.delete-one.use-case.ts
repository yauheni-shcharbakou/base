import { NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

/**
 * Deletes a folder or a leaf by marking it — and, for a folder, everything under it — deleted. That
 * hides it from the tree at once; the rows, and the objects at the provider, are removed later by
 * the cleanup crons: the file cleanup takes the media under a deleted storage object (the leaf row
 * goes with its file through the FK cascade), the storage-object cleanup takes the emptied folders.
 * No restore — the mark exists so a large folder is deleted in one statement, not to be undone.
 */
@Injectable()
export class StorageObjectDeleteOneUseCase {
  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  async execute(
    query: Partial<NestStorage.StorageObjectQuery>,
  ): Promise<Either<HttpException, NestStorage.StorageObject>> {
    const entity = await this.storageObjectRepository.getOne({ ...query, isDeleted: false });

    if (entity.isLeft()) {
      return entity;
    }

    // The root folder is the anchor of the user's tree — every placement resolves through it, so it
    // is not deletable. It is the only folder without a parent.
    if (entity.value.isFolder && !entity.value.parentId) {
      return left(new BadRequestException("You can't delete the root folder"));
    }

    const marked = await this.storageObjectRepository.markDeletedWithDescendants(entity.value.id);

    if (marked.isLeft()) {
      return left(new InternalServerErrorException(marked.value.message));
    }

    return right(entity.value);
  }
}
