import { PgMapper } from '@backend/pg';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { ObjectQuery } from '@mikro-orm/core';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageObjectQuery } from '@modules/storage-object/domain/repositories/storage-object.repository';
import _ from 'lodash';

// LIKE reads `%` and `_` as wildcards and `\` as its escape character; a searched name means them
// literally.
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

export class PgStorageObjectMapper extends PgMapper<
  PgStorageObjectEntity,
  StorageObject,
  StorageObjectQuery
> {
  // `StorageObjectPopulated` holds the media a read asked for. `parentId` is what the contract
  // carries: `parent` leads into its `children`, which the unit of work fills with every sibling it
  // inserts, so a batch of n cost n² (10 s for a thousand folders).
  protected readonly populate = ['file', 'image', 'video'];
  protected readonly exclude = [
    'parent',
    'children',
    'file.storageObject',
    'file.image',
    'file.video',
    'image.storageObject',
    'image.file',
    'video.storageObject',
    'video.file',
  ];

  transformQuery({
    isPublic,
    isFolder,
    isDeleted,
    isRoot,
    nameStartsWith,
    nameContains,
    types,
    excludeIds,
    ...rest
  }: Partial<StorageObjectQuery>): ObjectQuery<PgStorageObjectEntity> {
    const result = super.transformQuery(rest);

    if (_.isBoolean(isPublic)) {
      result.isPublic = isPublic;
    }

    if (_.isBoolean(isFolder)) {
      result.isFolder = isFolder;
    }

    if (_.isBoolean(isDeleted)) {
      result.isDeleted = isDeleted;
    }

    if (_.isBoolean(isRoot)) {
      result.parent = isRoot ? null : { $ne: null };
    }

    if (nameStartsWith) {
      result.name = { $like: `${nameStartsWith}%` };
    }

    if (nameContains) {
      result.name = { $ilike: `%${escapeLike(nameContains)}%` };
    }

    if (types?.length) {
      result.type = { $in: types };
    }

    if (excludeIds?.length) {
      result.id = { $nin: excludeIds };
    }

    return result;
  }
}
