import {
  GrpcFileUploadStatus,
  GrpcImage,
  GrpcImageCreate,
  GrpcImageCreateManyItem,
  GrpcImageCreateManyRequest,
  GrpcImageCreateManyResponse,
  GrpcImageCreateRequest,
  GrpcImagePopulated,
  GrpcImageQuery,
  GrpcImageUpdate,
  GrpcStorageObjectType,
} from '@backend/grpc';
import { CrudServiceImpl } from '@backend/persistence';
import { InjectNatsClient, NatsClient } from '@backend/transport';
import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import {
  FILE_REPOSITORY,
  FileCreate,
  FileRepository,
} from 'common/repositories/file/file.repository';
import {
  IMAGE_REPOSITORY,
  ImageCreate,
  ImageRepository,
} from 'common/repositories/image/image.repository';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from 'common/services/file-storage/file-storage.service';
import {
  STORAGE_OBJECT_SERVICE,
  StorageObjectService,
} from 'common/services/storage-object/storage-object.service';
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
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorageService: FileStorageService,
    @Inject(STORAGE_OBJECT_SERVICE)
    private readonly storageObjectService: StorageObjectService,
    @InjectNatsClient() private readonly natsClient: NatsClient,
  ) {
    super();
  }

  async createOne(
    request: GrpcImageCreateRequest,
    userId: string,
  ): Promise<Either<Error, GrpcImage>> {
    const revertHooks: (() => Promise<any>)[] = [];
    const providerId = await this.fileStorageService.createFile({ ...request.file, userId });

    if (providerId.isLeft()) {
      return left(providerId.value);
    }

    const file = await this.fileRepository.saveOne({
      ...request.file,
      userId,
      providerId: providerId.value,
      uploadId: providerId.value,
    });

    if (file.isLeft()) {
      return left(file.value);
    }

    revertHooks.push(() => this.fileRepository.deleteById(file.value.id));

    const image = await this.repository.saveOne({
      ...request.image,
      userId,
      file: file.value.id,
      uploadId: providerId.value,
    });

    if (image.isLeft()) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return image;
    }

    if (!request.storage) {
      return image;
    }

    revertHooks.push(() => this.repository.deleteById(image.value.id));

    const storage = await this.storageObjectService.createOne(
      {
        ...request.storage,
        type: GrpcStorageObjectType.IMAGE,
        file: image.value.fileId,
        image: image.value.id,
      },
      userId,
    );

    if (storage.isLeft()) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return left(storage.value);
    }

    return image;
  }

  async createMany(
    request: GrpcImageCreateManyRequest,
    userId: string,
  ): Promise<Either<Error, GrpcImageCreateManyResponse>> {
    const fileNames = new Set(_.map(request.items, 'file.originalName'));

    if (fileNames.size !== request.items.length) {
      return left(new BadRequestException('Names of created files should be unique'));
    }

    const revertHooks: (() => Promise<any>)[] = [];

    try {
      const dataByUploadId = new Map<string, GrpcImageCreateManyItem>();

      const fileData: FileCreate[] = await Promise.all(
        _.map(request.items, async (item) => {
          dataByUploadId.set(item.uploadId, item);

          const providerId = await this.fileStorageService.createFile({ ...item.file, userId });

          if (providerId.isLeft()) {
            throw providerId.value;
          }

          return {
            ...item.file,
            userId,
            providerId: providerId.value,
            uploadId: item.uploadId,
          };
        }),
      );

      const files = await this.fileRepository.saveMany(fileData);

      if (files.isLeft()) {
        return left(files.value);
      }

      revertHooks.push(() => this.fileRepository.deleteMany({ ids: _.map(files.value, 'id') }));

      const imageData: ImageCreate[] = _.map(files.value, (file) => {
        const data = dataByUploadId.get(file.uploadId);
        return { ...data.image, file: file.id, userId, uploadId: data.uploadId };
      });

      const images = await this.repository.saveMany(imageData);

      if (images.isLeft()) {
        await Promise.all(_.map(revertHooks, (hook) => hook()));
        return left(images.value);
      }

      const imageByFileId = new Map(_.map(images.value, (image) => [image.fileId, image]));

      revertHooks.push(() => this.repository.deleteMany({ ids: _.map(images.value, 'id') }));

      if (request.storage) {
        const storage = await this.storageObjectService.createManyFiles({
          ...request.storage,
          userId,
          files: _.map(files.value, (file) => {
            return {
              file: file.id,
              image: imageByFileId.get(file.id)?.id,
              name: file.originalName,
              type: GrpcStorageObjectType.IMAGE,
            };
          }),
        });

        if (storage.isLeft()) {
          await Promise.all(_.map(revertHooks, (hook) => hook()));
          return left(storage.value);
        }
      }

      return right({ items: images.value });
    } catch (error) {
      await Promise.all(_.map(revertHooks, (hook) => hook()));
      return left(error);
    }
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
