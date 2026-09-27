import { NestStorage } from '@backend/proto';
import { FileMapper } from '@modules/file/application/mappers/file.mapper';
import {
  ImageRepository,
  ImageSaveAndPlace,
} from '@modules/image/domain/repositories/image.repository';
import { StorageObjectPlacementService } from '@modules/storage-object/application/services/storage-object.placement.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';

@Injectable()
export class ImageCreateManyUseCase {
  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly storageFileService: StorageFileService,
    private readonly fileMapper: FileMapper,
    private readonly storageObjectPlacementService: StorageObjectPlacementService,
  ) {}

  async execute(
    createData: NestStorage.ImageCreateMany,
  ): Promise<Either<Error, NestStorage.ImageCreated[]>> {
    const fileNames = new Set(_.map(createData.items, 'file.originalName'));

    if (fileNames.size !== createData.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    // An `Image` does not carry its file's key, so each item's upload is signed while the key is
    // still in hand and matched back to the saved image by `uploadId`.
    const uploadByUploadId = new Map<string, NestStorage.FilePresignedUpload>();

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

          const upload = await this.storageFileService.getUploadUrl(providerId.value, item.file);

          if (upload.isLeft()) {
            throw upload.value;
          }

          uploadByUploadId.set(item.uploadId, upload.value);

          return {
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
        }),
      );

      const images = await this.storageObjectPlacementService.placeLeaves(
        createData.storage
          ? {
              userId: createData.userId,
              parent: createData.storage.parent,
              isPublic: createData.storage.isPublic,
              type: NestStorage.StorageObjectType.IMAGE,
              names: _.map(createData.items, 'file.originalName'),
            }
          : undefined,
        (leaves) =>
          this.imageRepository.saveAndPlaceMany(
            _.map(saveData, (item, index) => ({ ...item, storageObject: leaves?.[index] })),
          ),
      );

      if (images.isLeft()) {
        return left(images.value);
      }

      return right(
        _.map(images.value, (image) => ({ image, upload: uploadByUploadId.get(image.uploadId) })),
      );
    } catch (error) {
      return left(error);
    }
  }
}
