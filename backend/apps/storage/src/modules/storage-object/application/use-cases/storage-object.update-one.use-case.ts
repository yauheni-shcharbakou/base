import { StorageObjectParentUpdateEvent, StorageStorageObjectEventBus } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import {
  StorageObjectRepository,
  StorageObjectUpdate,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { StorageObjectValidationService } from '../services/storage-object.validation.service';

@Injectable()
export class StorageObjectUpdateOneUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageObjectValidationService: StorageObjectValidationService,
    private readonly eventBus: StorageStorageObjectEventBus,
  ) {}

  private async transformUpdate(
    entity: StorageObject,
    updateData: NestStorage.StorageObjectUpdate,
  ): Promise<Either<Error, StorageObjectUpdate>> {
    const update: StorageObjectUpdate = {
      set: _.pick(updateData.set ?? {}, ['isPublic']),
    };

    if (updateData.set?.name) {
      const name = await this.storageObjectValidationService.validateObjectName(entity);

      if (name.isLeft()) {
        return left(name.value);
      }

      update.set.name = name.value;
    }

    if (updateData.set?.parent) {
      if (entity.isFolder) {
        const childrenIds = await this.storageObjectRepository.getAllChildrenIds(entity.id);

        if (childrenIds.has(updateData.set.parent)) {
          return left(new BadRequestException('Invalid parent'));
        }
      }

      const placeData = await this.storageObjectValidationService.validatePlacement(
        updateData.set.parent,
        {
          ..._.pick(entity, ['id', 'type']),
          name: updateData.set.name ?? entity.name,
        },
      );

      if (placeData.isLeft()) {
        return left(placeData.value);
      }

      update.set.parent = updateData.set.parent;
      update.set.folderPath = placeData.value.folderPath;
      update.set.isPublic = placeData.value.isPublic;
    }

    return right(update);
  }

  async execute(
    query: NestStorage.StorageObjectQuery,
    updateData: NestStorage.StorageObjectUpdate,
  ): Promise<Either<Error, NestStorage.StorageObject>> {
    const storageObject = await this.storageObjectRepository.getOne(query);

    if (storageObject.isLeft()) {
      return storageObject;
    }

    const update = await this.transformUpdate(storageObject.value, updateData);

    if (update.isLeft()) {
      return left(update.value);
    }

    const entity = await this.storageObjectRepository.updateById(
      storageObject.value.id,
      update.value,
    );

    if (entity.isRight() && entity.value.isFolder) {
      const sideEffectUpdate: StorageObjectParentUpdateEvent['update'] = {};

      const isPublicChanged = storageObject.value.isPublic !== entity.value.isPublic;
      const isFolderPathChanged = storageObject.value.folderPath !== entity.value.folderPath;

      if (isPublicChanged) {
        sideEffectUpdate.isPublic = entity.value.isPublic;
      }

      if (isFolderPathChanged) {
        sideEffectUpdate.folderPath = entity.value.folderPath;
      }

      if (!_.isEmpty(sideEffectUpdate)) {
        await this.eventBus.emitParentUpdate({ parent: entity.value.id, update: sideEffectUpdate });
      }
    }

    return entity;
  }
}
