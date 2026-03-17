import {
  GrpcFileUploadStatus,
  GrpcStorageObject,
  GrpcStorageObjectCreate,
  GrpcStorageObjectPopulated,
  GrpcStorageObjectQuery,
  GrpcStorageObjectType,
  GrpcStorageObjectUpdate,
} from '@backend/grpc';
import { CrudServiceImpl } from '@backend/persistence';
import { InjectNatsClient, NatsClient, StorageObjectUpdateIsPublicEvent } from '@backend/transport';
import { BadRequestException, HttpException, Inject, NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import {
  STORAGE_OBJECT_REPOSITORY,
  StorageObjectRepository,
  StorageObjectUpdate,
} from 'common/repositories/storage-object/storage-object.repository';
import _ from 'lodash';
import { StorageObjectService } from 'modules/storage-object/service/storage-object.service';
import { firstValueFrom } from 'rxjs';

export class StorageObjectServiceImpl
  extends CrudServiceImpl<
    GrpcStorageObject,
    GrpcStorageObjectQuery,
    GrpcStorageObjectCreate,
    GrpcStorageObjectUpdate,
    StorageObjectRepository
  >
  implements StorageObjectService
{
  constructor(
    @Inject(STORAGE_OBJECT_REPOSITORY) protected readonly repository: StorageObjectRepository,
    @InjectNatsClient() private readonly natsClient: NatsClient,
  ) {
    super();
  }

  private async getFolderPath(
    parent: string,
    storageObject: Pick<GrpcStorageObject, 'type' | 'name'> & { id?: string },
  ): Promise<Either<HttpException, string | null>> {
    if (storageObject.id && parent === storageObject.id) {
      return left(new BadRequestException('Invalid parent'));
    }

    const parentFolder = await this.repository.getOne({
      id: parent,
      type: GrpcStorageObjectType.FOLDER,
    });

    if (parentFolder.isLeft()) {
      return left(new NotFoundException('Parent folder not found'));
    }

    if (storageObject.type === GrpcStorageObjectType.FOLDER) {
      return right(parentFolder.value.folderPath + storageObject.name + '/');
    }

    return right(null);
  }

  async createOne(
    request: GrpcStorageObjectCreate,
    userId: string,
  ): Promise<Either<Error, GrpcStorageObject>> {
    if (!request.parent) {
      return left(new BadRequestException('Parent is required'));
    }

    const folderPath = await this.getFolderPath(request.parent, _.pick(request, ['name', 'type']));

    if (folderPath.isLeft()) {
      return left(folderPath.value);
    }

    return this.repository.saveOne({ ...request, folderPath: folderPath.value, userId });
  }

  async updateById(
    id: string,
    updateData: GrpcStorageObjectUpdate,
  ): Promise<Either<NotFoundException, GrpcStorageObject>> {
    const update: StorageObjectUpdate = {
      set: _.pick(updateData.set ?? {}, ['name', 'isPublic']),
    };

    if (updateData.set?.parent) {
      const storageObject = await this.repository.getById(id);

      if (storageObject.isLeft()) {
        return storageObject;
      }

      if (storageObject.value.type === GrpcStorageObjectType.FOLDER) {
        return left(new BadRequestException('Replacement of folders is restricted'));
      }

      const folderPath = await this.getFolderPath(
        updateData.set.parent,
        _.pick(storageObject.value, ['id', 'type', 'name']),
      );

      if (folderPath.isLeft()) {
        return left(folderPath.value);
      }

      update.set.parent = updateData.set.parent;
      update.set.folderPath = folderPath.value;
    }

    const entity = await this.repository.updateById(id, updateData);

    if (
      entity.isRight() &&
      _.isBoolean(updateData.set?.isPublic) &&
      entity.value.type === GrpcStorageObjectType.FOLDER
    ) {
      await firstValueFrom(
        this.natsClient.storage.storageObject.updateIsPublic({
          parent: entity.value.id,
          isPublic: updateData.set.isPublic,
        }),
      );
    }

    return entity;
  }

  async deleteById(id: string): Promise<Either<NotFoundException, GrpcStorageObject>> {
    const entity = await this.repository.getById<GrpcStorageObjectPopulated>(id, {
      populate: ['file', 'video'],
    });

    if (entity.isLeft()) {
      return entity;
    }

    const isFileReady = entity.value.file?.uploadStatus === GrpcFileUploadStatus.READY;

    const deletedEntity = await super.deleteById(id);

    if (deletedEntity.isRight() && isFileReady) {
      switch (entity.value.type) {
        case GrpcStorageObjectType.VIDEO:
          if (!entity.value.video) {
            break;
          }

          await firstValueFrom(
            this.natsClient.storage.video.deleteOne({
              providerId: entity.value.video.providerId,
            }),
          );

          break;
        case GrpcStorageObjectType.FILE:
        case GrpcStorageObjectType.IMAGE:
          if (!entity.value.file) {
            break;
          }

          await firstValueFrom(
            this.natsClient.storage.file.deleteOne({
              providerId: entity.value.file.providerId,
            }),
          );

          break;
        default:
          break;
      }
    }

    return deletedEntity;
  }

  async onUpdateIsPublic(event: StorageObjectUpdateIsPublicEvent): Promise<void> {
    const folderIds = await this.repository.distinct('id', {
      parent: event.parent,
      type: GrpcStorageObjectType.FOLDER,
    });

    await this.repository.updateMany(
      { parent: event.parent, isPublic: !event.isPublic },
      { set: { isPublic: event.isPublic } },
    );

    await Promise.all(
      _.map(Array.from(folderIds), async (folderId) => {
        await firstValueFrom(
          this.natsClient.storage.storageObject.updateIsPublic({
            parent: folderId,
            isPublic: event.isPublic,
          }),
        );
      }),
    );
  }

  async createRootFolder(userId: string): Promise<void> {
    const hasRootFolder = await this.repository.isExists({
      userId,
      type: GrpcStorageObjectType.FOLDER,
    });

    if (hasRootFolder) {
      return;
    }

    await this.repository.saveOne({
      userId,
      type: GrpcStorageObjectType.FOLDER,
      name: '',
      isPublic: false,
      folderPath: '/',
    });
  }
}
