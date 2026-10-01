import { NestStorage } from '@backend/proto';
import {
  FilePurgeService,
  toFileEvents,
} from '@modules/file/application/services/file.purge.service';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

@Injectable()
export class ImageDeleteOneUseCase {
  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly filePurgeService: FilePurgeService,
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

    const deletedImage = await this.imageRepository.deleteWithFile(image.value.id);

    if (deletedImage.isLeft()) {
      return deletedImage;
    }

    // Not gated on READY — the bytes of a direct upload can land before it is completed.
    const providerId = image.value.file.providerId;

    if (providerId) {
      await this.filePurgeService.purge(toFileEvents(providerId, image.value.previewProviderId));
    }

    return image;
  }
}
