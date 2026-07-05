import { NestStorage } from '@backend/proto';
import { FileMapper } from '@modules/file/application/mappers/file.mapper';
import {
  ImageRepository,
  ImageSaveAndPlace,
} from '@modules/image/domain/repositories/image.repository';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';

@Injectable()
export class ImageCreateOneUseCase {
  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly storageFileService: StorageFileService,
    private readonly fileMapper: FileMapper,
    private readonly storageObjectValidationService: StorageObjectValidationService,
  ) {}

  async execute(createData: NestStorage.ImageCreateOne): Promise<Either<Error, NestStorage.Image>> {
    const providerId = await this.storageFileService.createFile({
      ...createData.file,
      userId: createData.userId,
    });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const saveData: ImageSaveAndPlace = {
      image: {
        ...createData.image,
        userId: createData.userId,
        uploadId: providerId.value,
      },
      file: this.fileMapper.toCreateData({
        ...createData.file,
        providerId: providerId.value,
      }),
    };

    if (createData.storage) {
      const validationResult = await this.storageObjectValidationService.validateCreateData({
        ...createData.storage,
        type: NestStorage.StorageObjectType.IMAGE,
        userId: createData.userId,
      });

      if (validationResult.isLeft()) {
        return left(validationResult.value);
      }

      saveData.storageObject = validationResult.value;
    }

    return this.imageRepository.saveAndPlaceOne(saveData);
  }
}
