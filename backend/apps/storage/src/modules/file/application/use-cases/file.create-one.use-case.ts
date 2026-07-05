import { NestStorage } from '@backend/proto';
import {
  FileRepository,
  FileSaveAndPlace,
} from '@modules/file/domain/repositories/file.repository';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import { FileMapper } from '../mappers/file.mapper';

@Injectable()
export class FileCreateOneUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageFileService: StorageFileService,
    private readonly fileMapper: FileMapper,
    private readonly storageObjectValidationService: StorageObjectValidationService,
  ) {}

  async execute(createData: NestStorage.FileCreateOne): Promise<Either<Error, NestStorage.File>> {
    const providerId = await this.storageFileService.createFile({
      ...createData.file,
      userId: createData.userId,
    });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const saveData: FileSaveAndPlace = {
      file: this.fileMapper.toCreateData({
        ...createData.file,
        userId: createData.userId,
        providerId: providerId.value,
        uploadId: providerId.value,
      }),
    };

    if (createData.storage) {
      const validationResult = await this.storageObjectValidationService.validateCreateData({
        ...createData.storage,
        type: NestStorage.StorageObjectType.FILE,
        userId: createData.userId,
      });

      if (validationResult.isLeft()) {
        return left(validationResult.value);
      }

      saveData.storageObject = validationResult.value;
    }

    return this.fileRepository.saveAndPlaceOne(saveData);
  }
}
