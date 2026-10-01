import { NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { ConflictException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

@Injectable()
export class StorageObjectCreateRootFolderUseCase {
  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  async execute(userId: string): Promise<Either<Error, void>> {
    // Fast path only — the guarantee is the partial unique index on the table, since the caller is
    // an at-least-once event handler and two of them may run this concurrently.
    const hasRootFolder = await this.storageObjectRepository.isExists({
      userId,
      type: NestStorage.StorageObjectType.FOLDER,
    });

    if (hasRootFolder) {
      return right(undefined);
    }

    const result = await this.storageObjectRepository.saveOne({
      userId,
      type: NestStorage.StorageObjectType.FOLDER,
      name: '',
      isPublic: false,
      isFolder: true,
    });

    // A conflict means a concurrent handler won the race — the folder exists, which is all the
    // caller asked for. Anything else has to reach the transport so the job is retried.
    if (result.isRight() || result.value instanceof ConflictException) {
      return right(undefined);
    }

    return left(result.value);
  }
}
