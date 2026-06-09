import { NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import _ from 'lodash';
import { StorageObjectValidationService } from '../services/storage-object.validation.service';

@Injectable()
export class StorageObjectCreateOneUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly validationService: StorageObjectValidationService,
  ) {}

  async execute(
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
}
