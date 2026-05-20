import { NestStorage } from '@backend/proto';
import {
  StorageObjectCreate,
  StorageObjectRepository,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import _ from 'lodash';
import { StorageObjectValidationService } from './storage-object.validation.service';

export interface StorageObjectCreateManyFiles extends NestStorage.StorageManyMeta {
  userId: string;
  files: Pick<NestStorage.StorageObjectCreate, 'name' | 'type' | 'file' | 'image' | 'video'>[];
}

@Injectable()
export class StorageObjectCreateService {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly validationService: StorageObjectValidationService,
  ) {}

  async createOne(
    createData: NestStorage.StorageObjectCreate,
  ): Promise<Either<Error, NestStorage.StorageObject>> {
    if (!createData.parent) {
      return left(new BadRequestException('Parent is required'));
    }

    const [name, placement] = await Promise.all([
      this.validationService.validateObjectName(_.pick(createData, ['name', 'type', 'parent'])),
      this.validationService.validatePlacement(
        createData.parent,
        _.pick(createData, ['name', 'type']),
      ),
    ]);

    if (name.isLeft()) {
      return left(name.value);
    }

    if (placement.isLeft()) {
      return left(placement.value);
    }

    return this.storageObjectRepository.saveOne({
      ...createData,
      folderPath: placement.value.folderPath,
      isPublic: placement.value.isPublic,
      name: name.value,
      isFolder: createData.type === NestStorage.StorageObjectType.FOLDER,
    });
  }

  async createManyFiles(
    createData: StorageObjectCreateManyFiles,
  ): Promise<Either<Error, NestStorage.StorageObject[]>> {
    try {
      const saveData: StorageObjectCreate[] = await Promise.all(
        _.map(createData.files, async (file) => {
          const name = await this.validationService.validateObjectName({
            name: file.name,
            type: file.type,
            parent: createData.parent,
          });

          if (name.isLeft()) {
            throw name.value;
          }

          return {
            ...file,
            userId: createData.userId,
            name: name.value,
            isPublic: createData.isPublic,
            parent: createData.parent,
            isFolder: false,
          };
        }),
      );

      return this.storageObjectRepository.saveMany(saveData);
    } catch (error) {
      return left(error);
    }
  }
}
