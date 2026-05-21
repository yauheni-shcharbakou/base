import { NestStorage } from '@backend/proto';
import {
  FileCreate,
  FileCreateService,
} from '@modules/file/application/services/file.create.service';
import { ImageCreate, ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { StorageObjectCreateService } from '@modules/storage-object/application/services/storage-object.create.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';

@Injectable()
export class ImageCreateManyUseCase {
  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly storageFileService: StorageFileService,
    private readonly fileCreateService: FileCreateService,
    private readonly storageObjectCreateService: StorageObjectCreateService,
  ) {}

  async execute(request: NestStorage.ImageCreateMany): Promise<Either<Error, NestStorage.Image[]>> {
    const fileNames = new Set(_.map(request.items, 'file.originalName'));

    if (fileNames.size !== request.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    const revertHooks: (() => Promise<any>)[] = [];

    try {
      const dataByUploadId = new Map<string, NestStorage.ImageCreateManyItem>();

      const fileData: FileCreate[] = await Promise.all(
        _.map(request.items, async (item) => {
          dataByUploadId.set(item.uploadId, item);

          const providerId = await this.storageFileService.createFile({
            ...item.file,
            userId: request.userId,
          });

          if (providerId.isLeft()) {
            throw providerId.value;
          }

          return {
            ...item.file,
            userId: request.userId,
            providerId: providerId.value,
            uploadId: item.uploadId,
          };
        }),
      );

      const files = await this.fileCreateService.createMany(fileData);

      if (files.isLeft()) {
        return left(files.value);
      }

      const imageData: ImageCreate[] = _.map(files.value, (file) => {
        const data = dataByUploadId.get(file.uploadId);

        return {
          ...data.image,
          file: file.id,
          userId: request.userId,
          uploadId: data.uploadId,
        };
      });

      const images = await this.imageRepository.saveMany(imageData);

      if (images.isLeft()) {
        await Promise.all(_.map(revertHooks, (hook) => hook()));
        return left(images.value);
      }

      const imageByFileId = new Map(_.map(images.value, (image) => [image.fileId, image]));

      revertHooks.push(() => this.imageRepository.deleteMany({ ids: _.map(images.value, 'id') }));

      if (request.storage) {
        const storage = await this.storageObjectCreateService.createManyFiles({
          ...request.storage,
          userId: request.userId,
          files: _.map(files.value, (file) => {
            return {
              file: file.id,
              image: imageByFileId.get(file.id)?.id,
              name: file.originalName,
              type: NestStorage.StorageObjectType.IMAGE,
            };
          }),
        });

        if (storage.isLeft()) {
          await Promise.all(_.map(revertHooks, (hook) => hook()));
          return left(storage.value);
        }
      }

      return right(images.value);
    } catch (error) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return left(error);
    }
  }
}
