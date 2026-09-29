import { NestCommon, NestStorage } from '@backend/proto';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

// Folders come first, whatever the caller sorts by.
const FOLDERS_FIRST: NestCommon.Sorter = { field: 'isFolder', order: NestCommon.Sort.desc };
const BY_NAME: NestCommon.Sorter = { field: 'name', order: NestCommon.Sort.asc };
// Names are unique among a folder's live objects, dates and types are not: the id makes every order
// total, so an offset page never repeats or skips a row that ties with its neighbour.
const BY_ID: NestCommon.Sorter = { field: 'id', order: NestCommon.Sort.asc };

const SORT_FIELDS: Record<NestStorage.StorageObjectSortField, keyof StorageObject> = {
  [NestStorage.StorageObjectSortField.NAME]: 'name',
  [NestStorage.StorageObjectSortField.CREATED_AT]: 'createdAt',
  [NestStorage.StorageObjectSortField.UPDATED_AT]: 'updatedAt',
  [NestStorage.StorageObjectSortField.TYPE]: 'type',
};

/**
 * A page of one folder of a user's tree, with what a folder view shows around it: the folder's path
 * and the folders above it. The scope — this folder, its owner's tree, live objects only — is fixed
 * here. The caller narrows it through the content query alone, never through free-form list filters,
 * which the repository would apply over it.
 *
 * A read, so it takes no tree lock: a write that lands between its statements shows on the next call.
 */
@Injectable()
export class StorageObjectGetFolderContentUseCase {
  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  async execute(
    request: NestStorage.StorageObjectGetFolderContent,
  ): Promise<Either<Error, NestStorage.StorageObjectFolderContent>> {
    // A missing folder, a deleted one, another user's and a leaf are the same `NotFound`: a user's
    // tree is closed.
    const folder = await this.storageObjectRepository.getOne<NestStorage.StorageObjectPopulated>(
      {
        id: request.parentId,
        userId: request.userId,
        type: NestStorage.StorageObjectType.FOLDER,
        isDeleted: false,
      },
      { populate: ['folderPath'] },
    );

    if (folder.isLeft()) {
      return left(folder.value);
    }

    const ancestors = await this.storageObjectRepository.getAncestors(folder.value.id);

    if (ancestors.isLeft()) {
      return left(ancestors.value);
    }

    const { items, total } =
      await this.storageObjectRepository.getList<NestStorage.StorageObjectPopulated>(
        {
          query: {
            parent: folder.value.id,
            userId: request.userId,
            isDeleted: false,
            types: request.query?.types,
            isPublic: request.query?.isPublic,
            nameContains: request.query?.search,
          },
          sorters: this.getSorters(request.sorters),
          pagination: request.pagination,
        },
        // No path per item: a subfolder's is the folder's own followed by its name.
        { populate: ['file', 'image', 'video'] },
      );

    return right({ folder: folder.value, ancestors: ancestors.value, items, total });
  }

  private getSorters(sorters: NestStorage.StorageObjectSorter[] = []): NestCommon.Sorter[] {
    const requested = sorters.map(({ field, order }) => ({ field: SORT_FIELDS[field], order }));
    return [FOLDERS_FIRST, ...(requested.length ? requested : [BY_NAME]), BY_ID];
  }
}
