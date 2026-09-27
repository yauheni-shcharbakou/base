import { NestStorage } from '@backend/proto';
import { FileMapper } from '@modules/file/application/mappers/file.mapper';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { StorageObjectPlacementService } from '@modules/storage-object/application/services/storage-object.placement.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

@Injectable()
export class ImageCreateOneUseCase {
  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly storageFileService: StorageFileService,
    private readonly fileMapper: FileMapper,
    private readonly storageObjectPlacementService: StorageObjectPlacementService,
  ) {}

  async execute(
    createData: NestStorage.ImageCreateOne,
  ): Promise<Either<Error, NestStorage.ImageCreated>> {
    const providerId = await this.storageFileService.createFile({
      ...createData.file,
      userId: createData.userId,
    });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const imageData = {
      ...createData.image,
      userId: createData.userId,
      uploadId: providerId.value,
    };
    const fileData = this.fileMapper.toCreateData({
      ...createData.file,
      providerId: providerId.value,
    });

    const image = await this.storageObjectPlacementService.placeLeaves(
      createData.storage
        ? {
            userId: createData.userId,
            parent: createData.storage.parent,
            isPublic: createData.storage.isPublic,
            type: NestStorage.StorageObjectType.IMAGE,
            names: [createData.storage.name],
          }
        : undefined,
      (leaves) =>
        this.imageRepository.saveAndPlaceOne({
          image: imageData,
          file: fileData,
          storageObject: leaves?.[0],
        }),
    );

    if (image.isLeft()) {
      return left(image.value);
    }

    // The bytes go straight to Bunny; the caller completes the upload by the image's `fileId`.
    const upload = await this.storageFileService.getUploadUrl(providerId.value, createData.file);

    if (upload.isLeft()) {
      return left(upload.value);
    }

    return right({ image: image.value, upload: upload.value });
  }
}
