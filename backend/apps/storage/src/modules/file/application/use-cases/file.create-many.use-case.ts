import { NestStorage } from '@backend/proto';
import {
  FileRepository,
  FileSaveAndPlace,
} from '@modules/file/domain/repositories/file.repository';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import _ from 'lodash';
import { FileMapper } from '../mappers/file.mapper';

@Injectable()
export class FileCreateManyUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageFileService: StorageFileService,
    private readonly fileMapper: FileMapper,
    private readonly storageObjectValidationService: StorageObjectValidationService,
  ) {}

  async execute(
    createData: NestStorage.FileCreateMany,
  ): Promise<Either<Error, NestStorage.File[]>> {
    const fileNames = new Set(_.map(createData.items, 'file.originalName'));

    if (fileNames.size !== createData.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    try {
      const saveData: FileSaveAndPlace[] = await Promise.all(
        _.map(createData.items, async (item): Promise<FileSaveAndPlace> => {
          const providerId = await this.storageFileService.createFile({
            ...item.file,
            userId: createData.userId,
          });

          if (providerId.isLeft()) {
            throw providerId.value;
          }

          const createItem: FileSaveAndPlace = {
            file: this.fileMapper.toCreateData({
              ...item.file,
              userId: createData.userId,
              providerId: providerId.value,
              uploadId: item.uploadId,
            }),
          };

          if (createData.storage) {
            const name = await this.storageObjectValidationService.validateObjectName({
              name: item.file.originalName,
              type: NestStorage.StorageObjectType.FILE,
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

      return this.fileRepository.saveAndPlaceMany(saveData);
    } catch (error) {
      return left(error);
    }
  }
}
