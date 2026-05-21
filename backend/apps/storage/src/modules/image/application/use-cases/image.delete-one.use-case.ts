import { NestStorage } from '@backend/proto';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

@Injectable()
export class ImageDeleteOneUseCase {
  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly storageFileService: StorageFileService,
  ) {}

  async execute(
    query: NestStorage.ImageQuery,
  ): Promise<Either<NotFoundException, NestStorage.Image>> {
    const image = await this.imageRepository.getOne<NestStorage.ImagePopulated>(query, {
      populate: ['file'],
    });

    if (image.isLeft()) {
      return image;
    }

    const deletedImage = await this.imageRepository.deleteById(image.value.id);
    const isFileReady = image.value.file.uploadStatus === NestStorage.FileUploadStatus.READY;
    const providerId = image.value.file.providerId;

    if (deletedImage.isLeft() || !isFileReady || !providerId) {
      return deletedImage;
    }

    await this.storageFileService.deleteFile(providerId);
    return image;
  }
}
