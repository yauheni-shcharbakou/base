import {
  GrpcBooleanResult,
  GrpcFileUploadStatus,
  GrpcStorageObject,
  GrpcStorageObjectCreate,
  GrpcStorageObjectExistsFolderRequest,
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
  StorageObjectCreate,
  StorageObjectRepository,
  StorageObjectUpdate,
} from 'common/repositories/storage-object/storage-object.repository';
import {
  StorageObjectCreateManyFiles,
  StorageObjectService,
} from 'common/services/storage-object/storage-object.service';
import _ from 'lodash';
import path from 'node:path';
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

    if (storageObject.type !== GrpcStorageObjectType.FOLDER) {
      return right(null);
    }

    const parentFolder = await this.repository.getOne({
      id: parent,
      type: GrpcStorageObjectType.FOLDER,
    });

    if (parentFolder.isLeft()) {
      return left(new NotFoundException('Parent folder not found'));
    }

    return right(parentFolder.value.folderPath + storageObject.name + '/');
  }

  private async checkObjectName(
    data: Pick<GrpcStorageObjectCreate, 'name' | 'type' | 'parent'>,
  ): Promise<Either<HttpException, string>> {
    if (data.type === GrpcStorageObjectType.FOLDER) {
      const isExistsFolderWithSameName = await this.repository.isExists({
        parent: data.parent,
        name: data.name,
        type: GrpcStorageObjectType.FOLDER,
      });

      if (isExistsFolderWithSameName) {
        return left(new BadRequestException('Folder name should be unique across the folder'));
      }

      return right(data.name);
    }

    const parsedName = path.parse(data.name);

    const fileNames = await this.repository.distinct('name', {
      parent: data.parent,
      nameStratsWith: parsedName.name,
    });

    const escapeRegexp = /[.*+?^${}()|[\]\\]/g;
    const escapedName = parsedName.name.replace(escapeRegexp, '\\$&');
    const escapedExt = parsedName.ext.replace(escapeRegexp, '\\$&');
    const re = new RegExp(`^${escapedName}(?: \\((?<num>\\d+)\\))?${escapedExt}$`);

    let maxNum = -1;
    let baseFileExists = false;

    for (const fileName of fileNames) {
      const match = fileName.match(re);

      if (match) {
        if (!match.groups.num) {
          baseFileExists = true;

          if (maxNum < 0) {
            maxNum = 0;
          }
        } else {
          const n = parseInt(match.groups.num, 10);

          if (n > maxNum) {
            maxNum = n;
          }
        }
      }
    }

    if (!baseFileExists) {
      return right(data.name);
    }

    return right(`${parsedName.name} (${maxNum + 1})${parsedName.ext}`);
  }

  async createOne(
    request: GrpcStorageObjectCreate,
    userId: string,
  ): Promise<Either<Error, GrpcStorageObject>> {
    if (!request.parent) {
      return left(new BadRequestException('Parent is required'));
    }

    const [name, folderPath] = await Promise.all([
      this.checkObjectName(request),
      this.getFolderPath(request.parent, _.pick(request, ['name', 'type'])),
    ]);

    if (name.isLeft()) {
      return left(name.value);
    }

    if (folderPath.isLeft()) {
      return left(folderPath.value);
    }

    return this.repository.saveOne({
      ...request,
      folderPath: folderPath.value,
      userId,
      name: name.value,
      isFolder: request.type === GrpcStorageObjectType.FOLDER,
    });
  }

  async createManyFiles(
    createData: StorageObjectCreateManyFiles,
  ): Promise<Either<Error, GrpcStorageObject[]>> {
    try {
      const saveData: StorageObjectCreate[] = await Promise.all(
        _.map(createData.files, async (file) => {
          const name = await this.checkObjectName({
            name: file.name,
            type: file.type,
            parent: createData.parent,
          });

          if (name.isLeft()) {
            throw name.value;
          }

          return {
            ...file,
            userId: createData.userId,
            name: name.value,
            isPublic: createData.isPublic,
            parent: createData.parent,
            isFolder: file.type === GrpcStorageObjectType.FOLDER,
          };
        }),
      );

      return this.repository.saveMany(saveData);
    } catch (error) {
      return left(error);
    }
  }

  async updateById(
    id: string,
    updateData: GrpcStorageObjectUpdate,
  ): Promise<Either<NotFoundException, GrpcStorageObject>> {
    const storageObject = await this.repository.getById(id);

    if (storageObject.isLeft()) {
      return storageObject;
    }

    const update: StorageObjectUpdate = {
      set: _.pick(updateData.set ?? {}, ['isPublic']),
    };

    if (updateData.set?.name) {
      const name = await this.checkObjectName(storageObject.value);

      if (name.isLeft()) {
        return left(name.value);
      }

      update.set.name = name.value;
    }

    if (updateData.set?.parent) {
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
      isFolder: true,
    });
  }

  async isExistsFolder(
    request: GrpcStorageObjectExistsFolderRequest,
    userId: string,
  ): Promise<GrpcBooleanResult> {
    const hasFolder = await this.repository.isExists({
      userId,
      name: request.name,
      parent: request.parent,
      type: GrpcStorageObjectType.FOLDER,
    });

    return { value: hasFolder };
  }
}
