import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageObjectPlacementService } from '@modules/storage-object/application/services/storage-object.placement.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { FileMapper } from '../mappers/file.mapper';

@Injectable()
export class FileCreateOneUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageFileService: StorageFileService,
    private readonly fileMapper: FileMapper,
    private readonly storageObjectPlacementService: StorageObjectPlacementService,
  ) {}

  async execute(
    createData: NestStorage.FileCreateOne,
  ): Promise<Either<Error, NestStorage.FileCreated>> {
    const providerId = await this.storageFileService.createFile({
      ...createData.file,
      userId: createData.userId,
    });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const fileData = this.fileMapper.toCreateData({
      ...createData.file,
      userId: createData.userId,
      providerId: providerId.value,
    });

    const file = await this.storageObjectPlacementService.placeLeaves(
      createData.storage
        ? {
            userId: createData.userId,
            parent: createData.storage.parent,
            isPublic: createData.storage.isPublic,
            type: NestStorage.StorageObjectType.FILE,
            names: [createData.storage.name],
          }
        : undefined,
      (leaves) =>
        this.fileRepository.saveAndPlaceOne({ file: fileData, storageObject: leaves?.[0] }),
    );

    if (file.isLeft()) {
      return left(file.value);
    }

    // The bytes never reach us: the caller PUTs them straight to Bunny with these credentials,
    // then confirms through `completeUpload`.
    const upload = await this.storageFileService.getUploadUrl(providerId.value, createData.file);

    if (upload.isLeft()) {
      return left(upload.value);
    }

    return right({ file: file.value, upload: upload.value });
  }
}
