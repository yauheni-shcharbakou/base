import { NestStorage } from '@backend/proto';
import {
  StorageObjectQuery,
  StorageObjectRepository,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageObjectGetFoldersUseCase {
  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  async execute(
    request: NestStorage.StorageObjectGetFolders,
  ): Promise<NestStorage.StorageObjectPopulated[]> {
    const query: StorageObjectQuery = {
      userId: request.userId,
      isFolder: true,
    };

    if (request.excludeChildrenOf) {
      const childrenIds = await this.storageObjectRepository.getAllChildrenIds(
        request.excludeChildrenOf,
      );

      childrenIds.add(request.excludeChildrenOf);
      query.excludeIds = Array.from(childrenIds);
    }

    // A folder has no media to populate; its path is what the folder pickers show. One statement for
    // every folder of the user — the path is a subquery of the same SELECT, not a query per row.
    return this.storageObjectRepository.getMany<NestStorage.StorageObjectPopulated>(query, {
      populate: ['folderPath'],
    });
  }
}
