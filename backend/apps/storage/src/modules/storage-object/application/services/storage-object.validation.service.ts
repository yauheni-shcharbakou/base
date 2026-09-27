import { NestStorage } from '@backend/proto';
import {
  StorageObjectCreate,
  StorageObjectRepository,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import path from 'path';

// A placement no longer carries a path: `folderPath` is derived from the tree on read.
export type StorageObjectPlacement = {
  isPublic: boolean;
};

export type StorageObjectCreateValidated = Omit<StorageObjectCreate, 'parent'> & {
  parent: string;
};

/** Where a renamed or moved object ends up. */
export type StorageObjectNameTarget = {
  /** The object itself, which never clashes with its own name. */
  id: string;
  name: string;
  parent: string;
  isFolder: boolean;
};

const FOLDER_NAME_TAKEN = 'Folder name should be unique across the folder';
const FILE_NAME_TAKEN = 'File name should be unique across the folder';

@Injectable()
export class StorageObjectValidationService {
  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  /** `objectId` is the object being moved, if it already exists — it cannot be its own parent. */
  async validatePlacement(
    parent: string,
    objectId?: string,
  ): Promise<Either<HttpException, StorageObjectPlacement>> {
    if (objectId && parent === objectId) {
      return left(new BadRequestException('Invalid parent'));
    }

    const parentFolder = await this.storageObjectRepository.getOne({
      id: parent,
      type: NestStorage.StorageObjectType.FOLDER,
    });

    if (parentFolder.isLeft()) {
      return left(new NotFoundException('Parent folder not found'));
    }

    return right({ isPublic: parentFolder.value.isPublic });
  }

  /**
   * For a rename or a move: the name must be free in the folder the object ends up in. Taken means
   * what create treats as taken, so an update never produces a name create would not. Unlike create,
   * a taken file name is refused rather than suffixed: an edit applies the name it was given or fails.
   */
  async validateNameIsFree(
    target: StorageObjectNameTarget,
  ): Promise<Either<HttpException, string>> {
    const isTaken = await this.isNameTaken(target);

    if (isTaken) {
      return left(new BadRequestException(target.isFolder ? FOLDER_NAME_TAKEN : FILE_NAME_TAKEN));
    }

    return right(target.name);
  }

  /** For a create: a taken folder name is refused, a taken file name gets a ` (n)` suffix. */
  async validateObjectName(
    createData: Pick<NestStorage.StorageObjectCreate, 'name' | 'type' | 'parent'>,
  ): Promise<Either<HttpException, string>> {
    if (createData.type === NestStorage.StorageObjectType.FOLDER) {
      const isTaken = await this.isNameTaken({
        name: createData.name,
        parent: createData.parent,
        isFolder: true,
      });

      if (isTaken) {
        return left(new BadRequestException(FOLDER_NAME_TAKEN));
      }

      return right(createData.name);
    }

    const parsedName = path.parse(createData.name);

    const fileNames = await this.storageObjectRepository.distinct('name', {
      parent: createData.parent,
      nameStartsWith: parsedName.name,
      isDeleted: false,
    });

    const escapeRegexp = /[.*+?^${}()|[\]\\]/g;
    const escapedName = parsedName.name.replace(escapeRegexp, '\\$&');
    const escapedExt = parsedName.ext.replace(escapeRegexp, '\\$&');
    const re = new RegExp(`^${escapedName}(?: \\((?<num>\\d+)\\))?${escapedExt}$`);

    let maxNum = -1;
    let baseFileExists = false;

    for (const fileName of fileNames) {
      const match = fileName.match(re);

      if (match) {
        if (!match.groups.num) {
          baseFileExists = true;

          if (maxNum < 0) {
            maxNum = 0;
          }
        } else {
          const n = parseInt(match.groups.num, 10);

          if (n > maxNum) {
            maxNum = n;
          }
        }
      }
    }

    if (!baseFileExists) {
      return right(createData.name);
    }

    return right(`${parsedName.name} (${maxNum + 1})${parsedName.ext}`);
  }

  async validateCreateData(
    createData: NestStorage.StorageObjectCreate,
  ): Promise<Either<Error, StorageObjectCreateValidated>> {
    if (!createData.parent) {
      return left(new BadRequestException('Parent is required'));
    }

    const [name, placement] = await Promise.all([
      this.validateObjectName(_.pick(createData, ['name', 'type', 'parent'])),
      this.validatePlacement(createData.parent),
    ]);

    if (name.isLeft()) {
      return left(name.value);
    }

    if (placement.isLeft()) {
      return left(placement.value);
    }

    return right({
      ...createData,
      parent: createData.parent,
      isPublic: placement.value.isPublic,
      name: name.value,
      isFolder: createData.type === NestStorage.StorageObjectType.FOLDER,
    });
  }

  // A folder's name is taken by another folder; a file's by any object, as the create-time suffix
  // counts every sibling. Deleted objects are hidden and on their way out, so their names are free.
  private isNameTaken({
    id,
    name,
    parent,
    isFolder,
  }: Omit<StorageObjectNameTarget, 'id'> & { id?: string }): Promise<boolean> {
    return this.storageObjectRepository.isExists({
      parent,
      name,
      isDeleted: false,
      ...(isFolder ? { type: NestStorage.StorageObjectType.FOLDER } : {}),
      ...(id ? { excludeIds: [id] } : {}),
    });
  }
}
