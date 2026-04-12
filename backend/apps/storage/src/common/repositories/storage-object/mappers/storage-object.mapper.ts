import { PostgresMapper } from '@backend/persistence';
import { GrpcStorageObject } from '@backend/grpc';
import { ObjectQuery, wrap } from '@mikro-orm/core';
import { StorageObjectEntity } from 'common/repositories/storage-object/entities/storage-object.entity';
import { StorageObjectQuery } from 'common/repositories/storage-object/storage-object.repository';
import _ from 'lodash';

export class StorageObjectMapper extends PostgresMapper<
  StorageObjectEntity,
  GrpcStorageObject,
  StorageObjectQuery
> {
  transformQuery({
    isPublic,
    isFolder,
    nameStratsWith,
    excludeIds,
    ...rest
  }: Partial<StorageObjectQuery>): ObjectQuery<StorageObjectEntity> {
    const result = super.transformQuery(rest);

    if (_.isBoolean(isPublic)) {
      result.isPublic = isPublic;
    }

    if (_.isBoolean(isFolder)) {
      result.isFolder = isFolder;
    }

    if (nameStratsWith) {
      result.name = { $like: `${nameStratsWith}%` };
    }

    if (excludeIds?.length) {
      result.id = { $nin: excludeIds };
    }

    return result;
  }

  stringify(entity: StorageObjectEntity): GrpcStorageObject {
    return _.omit(wrap(entity).toObject(), ['children']) as GrpcStorageObject;
  }
}
