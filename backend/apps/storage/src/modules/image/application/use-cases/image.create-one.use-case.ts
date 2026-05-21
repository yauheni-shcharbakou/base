import { NestStorage } from '@backend/proto';
import { FileCreateService } from '@modules/file/application/services/file.create.service';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { StorageObjectCreateService } from '@modules/storage-object/application/services/storage-object.create.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';

@Injectable()
export class ImageCreateOneUseCase {
  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly storageFileService: StorageFileService,
    private readonly fileCreateService: FileCreateService,
    private readonly storageObjectCreateService: StorageObjectCreateService,
  ) {}

  async execute(request: NestStorage.ImageCreateOne): Promise<Either<Error, NestStorage.Image>> {
    const providerId = await this.storageFileService.createFile({
      ...request.file,
      userId: request.userId,
    });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const file = await this.fileCreateService.createOne({
      ...request.file,
      userId: request.userId,
      providerId: providerId.value,
      uploadId: providerId.value,
    });

    if (file.isLeft()) {
      return left(file.value);
    }

    const image = await this.imageRepository.saveOne({
      ...request.image,
      userId: request.userId,
      file: file.value.id,
      uploadId: providerId.value,
    });

    if (image.isLeft() || !request.storage) {
      return image;
    }

    const storage = await this.storageObjectCreateService.createOne({
      ...request.storage,
      type: NestStorage.StorageObjectType.IMAGE,
      file: image.value.fileId,
      image: image.value.id,
      userId: request.userId,
    });

    if (storage.isLeft()) {
      await this.imageRepository.deleteById(image.value.id);
      return left(storage.value);
    }

    return image;
  }
}
