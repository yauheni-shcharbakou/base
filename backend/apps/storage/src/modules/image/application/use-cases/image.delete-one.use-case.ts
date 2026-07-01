import { ImageEventBus } from '@backend/event-bus';
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
    private readonly eventBus: ImageEventBus,
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

    if (deletedImage.isLeft()) {
      return deletedImage;
    }

    const hooks: Promise<any>[] = [this.eventBus.emitDelete(deletedImage.value)];
    const isFileReady = image.value.file.uploadStatus === NestStorage.FileUploadStatus.READY;
    const providerId = image.value.file.providerId;

    if (isFileReady && providerId) {
      hooks.push(this.storageFileService.deleteFile(providerId));
    }

    await Promise.allSettled(hooks);
    return image;
  }
}
