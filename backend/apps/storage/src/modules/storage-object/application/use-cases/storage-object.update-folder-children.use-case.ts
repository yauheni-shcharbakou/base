import { BulkUpdate } from '@backend/common';
import { StorageStorageObjectEventBus } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import {
  StorageObjectRepository,
  StorageObjectUpdate,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable } from '@nestjs/common';
import _ from 'lodash';

@Injectable()
export class StorageObjectUpdateFolderChildrenUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly eventBus: StorageStorageObjectEventBus,
  ) {}

  async execute(
    parent: string,
    update: Pick<StorageObjectUpdate['set'], 'isPublic' | 'folderPath'>,
  ): Promise<void> {
    if (_.isEmpty(update)) {
      return;
    }

    let page = 1;
    let hasNext = true;

    const limit = 100;
    const folderData: Pick<NestStorage.StorageObject, 'id' | 'folderPath'>[] = [];

    do {
      const { items, total } = await this.storageObjectRepository.getList({
        query: { parent },
        pagination: { page, limit },
      });

      await this.storageObjectRepository.bulkUpdate(
        _.reduce(
          items,
          (acc: BulkUpdate<StorageObject>[], item) => {
            const updateSet: BulkUpdate<StorageObject>['update']['set'] = {};
            const folderDataItem: Pick<NestStorage.StorageObject, 'id' | 'folderPath'> = {
              id: item.id,
            };

            if (update.isPublic && item.isPublic !== update.isPublic) {
              updateSet.isPublic = update.isPublic;
            }

            if (item.isFolder) {
              if (update.folderPath) {
                const newFolderPath = update.folderPath + item.name + '/';

                updateSet.folderPath = newFolderPath;
                folderDataItem.folderPath = newFolderPath;
              }

              folderData.push(folderDataItem);
            }

            if (!_.isEmpty(updateSet)) {
              acc.push({
                filter: { key: 'id', value: item.id },
                update: { set: updateSet },
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

    await this.eventBus.emitManyParentUpdate(
      _.map(folderData, ({ id, folderPath }) => {
        return {
          parent: id,
          update: {
            isPublic: update.isPublic,
            folderPath,
          },
        };
      }),
    );
  }
}
