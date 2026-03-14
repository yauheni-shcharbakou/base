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
import { BadRequestException, HttpException, Inject, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Either, left, right } from '@sweet-monads/either';
import { FileDeleteOneEvent, FileEventPattern } from 'common/events/file.events';
import { VideoDeleteOneEvent, VideoEventPattern } from 'common/events/video.events';
import {
  STORAGE_OBJECT_REPOSITORY,
  StorageObjectRepository,
  StorageObjectUpdate,
} from 'common/repositories/storage-object/storage-object.repository';
import _ from 'lodash';
import { StorageObjectService } from 'modules/storage-object/service/storage-object.service';

export class StorageObjectServiceImpl
  extends CrudServiceImpl<
    GrpcStorageObject,
    GrpcStorageObjectQuery,
    GrpcStorageObjectCreate,
    GrpcStorageObjectUpdate
  >
  implements StorageObjectService
{
  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject(STORAGE_OBJECT_REPOSITORY) protected readonly repository: StorageObjectRepository,
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

    return this.repository.updateById(id, updateData);
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

          this.eventEmitter.emit(
            VideoEventPattern.DELETE_ONE,
            new VideoDeleteOneEvent(entity.value.video.providerId),
          );

          break;
        case GrpcStorageObjectType.FILE:
        case GrpcStorageObjectType.IMAGE:
          this.eventEmitter.emit(
            FileEventPattern.DELETE_ONE,
            new FileDeleteOneEvent(entity.value.file.providerId),
          );

          break;
        default:
          break;
      }
    }

    return deletedEntity;
  }
}
