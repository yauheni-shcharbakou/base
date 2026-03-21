import {
  GrpcFileUploadStatus,
  GrpcImage,
  GrpcImageCreate,
  GrpcImageCreateRequest,
  GrpcImagePopulated,
  GrpcImageQuery,
  GrpcImageUpdate,
} from '@backend/grpc';
import { CrudServiceImpl } from '@backend/persistence';
import { InjectNatsClient, NatsClient } from '@backend/transport';
import { Inject, NotFoundException } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import { FILE_REPOSITORY, FileRepository } from 'common/repositories/file/file.repository';
import { IMAGE_REPOSITORY, ImageRepository } from 'common/repositories/image/image.repository';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from 'common/services/file-storage/file-storage.service';
import { ImageService } from 'modules/image/service/image.service';
import { firstValueFrom } from 'rxjs';

export class ImageServiceImpl
  extends CrudServiceImpl<GrpcImage, GrpcImageQuery, GrpcImageCreate, GrpcImageUpdate>
  implements ImageService
{
  constructor(
    @Inject(FILE_REPOSITORY) private readonly fileRepository: FileRepository,
    @Inject(IMAGE_REPOSITORY) protected readonly repository: ImageRepository,
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorageService: FileStorageService,
    @InjectNatsClient() private readonly natsClient: NatsClient,
  ) {
    super();
  }

  async createOne(
    request: GrpcImageCreateRequest,
    userId: string,
  ): Promise<Either<Error, GrpcImage>> {
    const providerId = await this.fileStorageService.createFile({ ...request.file, userId });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const file = await this.fileRepository.saveOne({
      ...request.file,
      userId,
      providerId: providerId.value,
    });

    if (file.isLeft()) {
      return left(file.value);
    }

    const image = await this.repository.saveOne({
      ...request.image,
      userId,
      file: file.value.id,
    });

    if (image.isLeft()) {
      await this.fileRepository.deleteById(file.value.id);
    }

    return image;
  }

  async deleteById(id: string): Promise<Either<NotFoundException, GrpcImage>> {
    const image = await this.repository.getById<GrpcImagePopulated>(id, { populate: ['file'] });

    if (image.isLeft()) {
      return image;
    }

    const deletedImage = await super.deleteById(id);

    if (deletedImage.isRight() && image.value.file.uploadStatus === GrpcFileUploadStatus.READY) {
      await firstValueFrom(
        this.natsClient.storage.file.deleteOne({ providerId: image.value.file.providerId }),
      );
    }

    return image;
  }
}
