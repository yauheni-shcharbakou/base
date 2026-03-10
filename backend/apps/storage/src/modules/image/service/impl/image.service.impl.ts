import {
  GrpcImage,
  GrpcImageCreate,
  GrpcImageCreateRequest,
  GrpcImageQuery,
  GrpcImageUpdate,
  GrpcStorageObjectType,
} from '@backend/grpc';
import { CrudServiceImpl } from '@backend/persistence';
import { Inject, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Either, left } from '@sweet-monads/either';
import { FILE_REPOSITORY, FileRepository } from 'common/repositories/file/file.repository';
import { IMAGE_REPOSITORY, ImageRepository } from 'common/repositories/image/image.repository';
import {
  STORAGE_OBJECT_REPOSITORY,
  StorageObjectRepository,
} from 'common/repositories/storage-object/storage-object.repository';
import _ from 'lodash';
import { ImageService } from 'modules/image/service/image.service';

export class ImageServiceImpl
  extends CrudServiceImpl<GrpcImage, GrpcImageQuery, GrpcImageCreate, GrpcImageUpdate>
  implements ImageService
{
  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject(FILE_REPOSITORY) private readonly fileRepository: FileRepository,
    @Inject(IMAGE_REPOSITORY) protected readonly repository: ImageRepository,
    @Inject(STORAGE_OBJECT_REPOSITORY)
    private readonly storageObjectRepository: StorageObjectRepository,
  ) {
    super();
  }

  async createOne(
    request: GrpcImageCreateRequest,
    userId: string,
  ): Promise<Either<Error, GrpcImage>> {
    const revertHooks: (() => Promise<any>)[] = [];
    const file = await this.fileRepository.saveOne({ ...request.file, userId });

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
    const image = await super.deleteById(id);

    if (image.isRight()) {
      // this.eventEmitter.emit('file.delete', { id: image.value.file });
    }

    return image;
  }

  async onFileDelete(file: string): Promise<void> {
    await this.repository.deleteOne({ file });
  }
}
