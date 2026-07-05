import { PgMapper } from '@backend/pg';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { ObjectQuery, wrap } from '@mikro-orm/core';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageObjectQuery } from '@modules/storage-object/domain/repositories/storage-object.repository';
import _ from 'lodash';

export class PgStorageObjectMapper extends PgMapper<
  PgStorageObjectEntity,
  StorageObject,
  StorageObjectQuery
> {
  transformQuery({
    isPublic,
    isFolder,
    isDeleted,
    nameStartsWith,
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

    if (nameStartsWith) {
      result.name = { $like: `${nameStartsWith}%` };
    }

    if (excludeIds?.length) {
      result.id = { $nin: excludeIds };
    }

    return result;
  }

  stringify(entity: PgStorageObjectEntity): StorageObject {
    return _.omit(wrap(entity).toObject(), ['children']) as StorageObject;
  }
}
