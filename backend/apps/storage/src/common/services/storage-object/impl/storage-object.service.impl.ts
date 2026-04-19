import {
  GrpcFileUploadStatus,
  GrpcStorageObject,
  GrpcStorageObjectCreate,
  GrpcStorageObjectExistsFolderRequest,
  GrpcStorageObjectGetFoldersItem,
  GrpcStorageObjectGetFoldersRequest,
  GrpcStorageObjectPopulated,
  GrpcStorageObjectQuery,
  GrpcStorageObjectType,
  GrpcStorageObjectUpdate,
} from '@backend/grpc';
import { BulkUpdate, CrudServiceImpl } from '@backend/persistence';
import { InjectNatsClient, NatsClient, StorageObjectUpdateParentEvent } from '@backend/transport';
import { BadRequestException, HttpException, Inject, NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import {
  STORAGE_OBJECT_REPOSITORY,
  StorageObjectCreate,
  StorageObjectQuery,
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

type PlaceData = {
  folderPath: string | null;
  isPublic: boolean;
};

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

  private async getPlaceData(
    parent: string,
    storageObject: Pick<GrpcStorageObject, 'type' | 'name'> & { id?: string },
  ): Promise<Either<HttpException, PlaceData>> {
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

    if (storageObject.type !== GrpcStorageObjectType.FOLDER) {
      return right({ isPublic: parentFolder.value.isPublic, folderPath: null });
    }

    return right({
      isPublic: parentFolder.value.isPublic,
      folderPath: parentFolder.value.folderPath + storageObject.name + '/',
    });
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

    const [name, placeData] = await Promise.all([
      this.checkObjectName(request),
      this.getPlaceData(request.parent, _.pick(request, ['name', 'type'])),
    ]);

    if (name.isLeft()) {
      return left(name.value);
    }

    if (placeData.isLeft()) {
      return left(placeData.value);
    }

    return this.repository.saveOne({
      ...request,
      folderPath: placeData.value.folderPath,
      isPublic: placeData.value.isPublic,
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
      if (storageObject.value.isFolder) {
        const childrenIds = await this.repository.getAllChildrenIds(storageObject.value.id);

        if (childrenIds.has(updateData.set.parent)) {
          return left(new BadRequestException('Invalid parent'));
        }
      }

      const placeData = await this.getPlaceData(
        updateData.set.parent,
        _.pick(storageObject.value, ['id', 'type', 'name']),
      );

      if (placeData.isLeft()) {
        return left(placeData.value);
      }

      update.set.parent = updateData.set.parent;
      update.set.folderPath = placeData.value.folderPath;
      update.set.isPublic = placeData.value.isPublic;
    }

    const entity = await this.repository.updateById(id, update);

    if (entity.isRight() && entity.value.isFolder) {
      const sideEffectUpdate: StorageObjectUpdateParentEvent['update'] = {};

      const isPublicChanged = storageObject.value.isPublic !== entity.value.isPublic;
      const isFolderPathChanged = storageObject.value.folderPath !== entity.value.folderPath;

      if (isPublicChanged) {
        sideEffectUpdate.isPublic = entity.value.isPublic;
      }

      if (isFolderPathChanged) {
        sideEffectUpdate.folderPath = entity.value.folderPath;
      }

      if (!_.isEmpty(sideEffectUpdate)) {
        await firstValueFrom(
          this.natsClient.storage.storageObject.updateParent({
            parent: entity.value.id,
            update: sideEffectUpdate,
          }),
        );
      }
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

    if (entity.value.isFolder) {
      const hasFiles = await this.repository.isExists({ parent: id });

      if (hasFiles) {
        return left(new BadRequestException("You can't delete folder with files"));
      }
    }

    const isFileReady = entity.value.file?.uploadStatus === GrpcFileUploadStatus.READY;

    const deletedEntity = await super.deleteById(id);

    if (deletedEntity.isRight() && isFileReady) {
      switch (entity.value.type) {
        case GrpcStorageObjectType.VIDEO:
          if (!entity.value.video?.providerId) {
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
          if (!entity.value.file?.providerId) {
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

  async onUpdateParent(event: StorageObjectUpdateParentEvent): Promise<void> {
    if (_.isEmpty(event.update)) {
      return;
    }

    let page = 1;
    let hasNext = true;

    const limit = 100;
    const folderData: Pick<GrpcStorageObject, 'id' | 'folderPath'>[] = [];

    do {
      const { items, total } = await this.repository.getList({
        query: { parent: event.parent },
        pagination: { page, limit },
      });

      await this.repository.bulkUpdate(
        _.reduce(
          items,
          (acc: BulkUpdate<GrpcStorageObject>[], item) => {
            const updateSet: BulkUpdate<GrpcStorageObject>['update']['set'] = {};
            const folderDataItem: Pick<GrpcStorageObject, 'id' | 'folderPath'> = { id: item.id };

            if (event.update.isPublic && item.isPublic !== event.update.isPublic) {
              updateSet.isPublic = event.update.isPublic;
            }

            if (item.isFolder) {
              if (event.update.folderPath) {
                const newFolderPath = event.update.folderPath + item.name + '/';

                updateSet.folderPath = newFolderPath;
                folderDataItem.folderPath = newFolderPath;
              }

              folderData.push(folderDataItem);
            }

            if (!_.isEmpty(updateSet)) {
              acc.push({
                filter: {
                  key: 'id',
                  value: item.id,
                },
                update: {
                  set: updateSet,
                },
              });
            }

            return acc;
          },
          [],
        ),
      );

      hasNext = page * limit < total;
      page += 1;
    } while (hasNext);

    await Promise.all(
      _.map(folderData, async ({ id, folderPath }) => {
        await firstValueFrom(
          this.natsClient.storage.storageObject.updateParent({
            parent: id,
            update: {
              isPublic: event.update.isPublic,
              folderPath,
            },
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
  ): Promise<boolean> {
    return await this.repository.isExists({
      userId,
      name: request.name,
      parent: request.parent,
      type: GrpcStorageObjectType.FOLDER,
    });
  }

  async getFolders(
    request: GrpcStorageObjectGetFoldersRequest,
    userId: string,
  ): Promise<GrpcStorageObjectGetFoldersItem[]> {
    const query: StorageObjectQuery = {
      userId,
      isFolder: true,
    };

    if (request.id) {
      const childrenIds = await this.repository.getAllChildrenIds(request.id);
      childrenIds.add(request.id);
      query.excludeIds = Array.from(childrenIds);
    }

    const entities = await this.repository.getMany(query);
    return _.map(entities, (entity) => ({ id: entity.id, folderPath: entity.folderPath }));
  }
}
