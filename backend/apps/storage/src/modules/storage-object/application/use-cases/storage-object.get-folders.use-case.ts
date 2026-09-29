import { NestStorage } from '@backend/proto';
import {
  StorageObjectQuery,
  StorageObjectRepository,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

@Injectable()
export class StorageObjectGetFoldersUseCase {
  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  async execute(
    request: NestStorage.StorageObjectGetFolders,
  ): Promise<Either<Error, NestStorage.StorageObjectPopulated[]>> {
    // A deleted folder waits for the cleanup cron, and a placement into it is refused: not a target.
    const query: StorageObjectQuery = {
      userId: request.userId,
      isFolder: true,
      isDeleted: false,
    };

    // The picker for a move leaves out the folder and its subtree. If the walk fails, the call
    // fails too: a list that still offers the subtree is not a safe fallback.
    if (request.excludeChildrenOf) {
      const childrenIds = await this.storageObjectRepository.getAllChildrenIds(
        request.excludeChildrenOf,
      );

      if (childrenIds.isLeft()) {
        return left(childrenIds.value);
      }

      query.excludeIds = [...childrenIds.value, request.excludeChildrenOf];
    }

    // A folder has no media to populate; its path is what the folder pickers show. One statement for
    // every folder of the user — the path is a subquery of the same SELECT, not a query per row.
    const folders = await this.storageObjectRepository.getMany<NestStorage.StorageObjectPopulated>(
      query,
      { populate: ['folderPath'] },
    );

    return right(folders);
  }
}
