import { NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import path from 'path';

export type StorageObjectPlacement = {
  folderPath: string | null;
  isPublic: boolean;
};

@Injectable()
export class StorageObjectValidationService {
  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  async validatePlacement(
    parent: string,
    storageObject: Pick<NestStorage.StorageObject, 'type' | 'name'> & { id?: string },
  ): Promise<Either<HttpException, StorageObjectPlacement>> {
    if (storageObject.id && parent === storageObject.id) {
      return left(new BadRequestException('Invalid parent'));
    }

    const parentFolder = await this.storageObjectRepository.getOne({
      id: parent,
      type: NestStorage.StorageObjectType.FOLDER,
    });

    if (parentFolder.isLeft()) {
      return left(new NotFoundException('Parent folder not found'));
    }

    if (storageObject.type !== NestStorage.StorageObjectType.FOLDER) {
      return right({ isPublic: parentFolder.value.isPublic, folderPath: null });
    }

    return right({
      isPublic: parentFolder.value.isPublic,
      folderPath: parentFolder.value.folderPath + storageObject.name + '/',
    });
  }

  async validateObjectName(
    createData: Pick<NestStorage.StorageObjectCreate, 'name' | 'type' | 'parent'>,
  ): Promise<Either<HttpException, string>> {
    if (createData.type === NestStorage.StorageObjectType.FOLDER) {
      const isExistsFolderWithSameName = await this.storageObjectRepository.isExists({
        parent: createData.parent,
        name: createData.name,
        type: NestStorage.StorageObjectType.FOLDER,
      });

      if (isExistsFolderWithSameName) {
        return left(new BadRequestException('Folder name should be unique across the folder'));
      }

      return right(createData.name);
    }

    const parsedName = path.parse(createData.name);

    const fileNames = await this.storageObjectRepository.distinct('name', {
      parent: createData.parent,
      nameStartsWith: parsedName.name,
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
}
