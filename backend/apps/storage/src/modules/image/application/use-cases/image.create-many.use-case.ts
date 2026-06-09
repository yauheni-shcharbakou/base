import { NestStorage } from '@backend/proto';
import { FileMapper } from '@modules/file/application/mappers/file.mapper';
import {
  ImageRepository,
  ImageSaveAndPlace,
} from '@modules/image/domain/repositories/image.repository';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import _ from 'lodash';

@Injectable()
export class ImageCreateManyUseCase {
  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly storageFileService: StorageFileService,
    private readonly fileMapper: FileMapper,
    private readonly storageObjectValidationService: StorageObjectValidationService,
  ) {}

  async execute(
    createData: NestStorage.ImageCreateMany,
  ): Promise<Either<Error, NestStorage.Image[]>> {
    const fileNames = new Set(_.map(createData.items, 'file.originalName'));

    if (fileNames.size !== createData.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    try {
      const saveData: ImageSaveAndPlace[] = await Promise.all(
        _.map(createData.items, async (item): Promise<ImageSaveAndPlace> => {
          const providerId = await this.storageFileService.createFile({
            ...item.file,
            userId: createData.userId,
          });

          if (providerId.isLeft()) {
            throw providerId.value;
          }

          const createItem: ImageSaveAndPlace = {
            image: {
              ...item.image,
              userId: createData.userId,
              uploadId: item.uploadId,
            },
            file: this.fileMapper.toCreateData({
              ...item.file,
              providerId: providerId.value,
            }),
          };

          if (createData.storage) {
            const name = await this.storageObjectValidationService.validateObjectName({
              name: item.file.originalName,
              type: NestStorage.StorageObjectType.IMAGE,
              parent: createData.storage.parent,
            });

            if (name.isLeft()) {
              throw name.value;
            }

            createItem.storageObject = {
              ...createData.storage,
              name: name.value,
            };
          }

          return createItem;
        }),
      );

      return this.imageRepository.saveAndPlaceMany(saveData);
    } catch (error) {
      return left(error);
    }
  }
}
