import {
  GrpcFileUploadStatus,
  GrpcImage,
  GrpcImageCreate,
  GrpcImageCreateRequest,
  GrpcImagePopulated,
  GrpcImageQuery,
  GrpcImageUpdate,
  GrpcStorageObjectType,
} from '@backend/grpc';
import { CrudServiceImpl } from '@backend/persistence';
import { NatsJsClient } from '@backend/transport';
import { Inject, NotFoundException } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import { FILE_REPOSITORY, FileRepository } from 'common/repositories/file/file.repository';
import { IMAGE_REPOSITORY, ImageRepository } from 'common/repositories/image/image.repository';
import {
  STORAGE_OBJECT_REPOSITORY,
  StorageObjectRepository,
} from 'common/repositories/storage-object/storage-object.repository';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from 'common/services/file-storage/file-storage.service';
import _ from 'lodash';
import { ImageService } from 'modules/image/service/image.service';
import { firstValueFrom } from 'rxjs';

export class ImageServiceImpl
  extends CrudServiceImpl<GrpcImage, GrpcImageQuery, GrpcImageCreate, GrpcImageUpdate>
  implements ImageService
{
  constructor(
    @Inject(FILE_REPOSITORY) private readonly fileRepository: FileRepository,
    @Inject(IMAGE_REPOSITORY) protected readonly repository: ImageRepository,
    @Inject(STORAGE_OBJECT_REPOSITORY)
    private readonly storageObjectRepository: StorageObjectRepository,
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorageService: FileStorageService,
    private readonly natsJsClient: NatsJsClient,
  ) {
    super();
  }

  async createOne(
    request: GrpcImageCreateRequest,
    userId: string,
  ): Promise<Either<Error, GrpcImage>> {
    const revertHooks: (() => Promise<any>)[] = [];

    const providerId = await firstValueFrom(
      this.fileStorageService.createFile({ ...request.file, userId }),
    );

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

    revertHooks.push(() => this.fileRepository.deleteById(file.value.id));

    const image = await this.repository.saveOne({
      ...request.image,
      userId,
      file: file.value.id,
    });

    if (image.isLeft()) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return image;
    }

    if (!request.storage) {
      return image;
    }

    revertHooks.push(() => this.deleteById(image.value.id));

    const storage = await this.storageObjectRepository.saveOne({
      ...request.storage,
      userId,
      file: file.value.id,
      image: image.value.id,
      type: GrpcStorageObjectType.IMAGE,
    });

    if (storage.isLeft()) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return left(storage.value);
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
        this.natsJsClient.storage.file.deleteOne({ providerId: image.value.file.providerId }),
      );
    }

    return image;
  }
}
