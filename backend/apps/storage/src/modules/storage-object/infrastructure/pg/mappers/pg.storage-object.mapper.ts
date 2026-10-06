import { PgMapper } from '@backend/pg';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { ObjectQuery, wrap } from '@mikro-orm/core';
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

  // `parentId` is what the contract carries. Serializing `parent` itself walks into its `children`,
  // which the unit of work fills with every sibling it inserts, so a batch of n cost n² (10 s for
  // a thousand folders). Ignored fields are never serialized, not dropped afterwards.
  stringify(entity: PgStorageObjectEntity): StorageObject {
    return wrap(entity).toObject(['children', 'parent']) as StorageObject;
  }
}
