import { PostgresMapper } from '@backend/persistence';
import { GrpcStorageObject, GrpcStorageObjectQuery } from '@backend/grpc';
import { ObjectQuery, wrap } from '@mikro-orm/core';
import { StorageObjectEntity } from 'common/repositories/storage-object/entities/storage-object.entity';
import _ from 'lodash';

export class StorageObjectMapper extends PostgresMapper<
  StorageObjectEntity,
  GrpcStorageObject,
  GrpcStorageObjectQuery
> {
  transformQuery({
    isPublic,
    ...rest
  }: Partial<GrpcStorageObjectQuery>): ObjectQuery<StorageObjectEntity> {
    const result = super.transformQuery(rest);

    if (_.isBoolean(isPublic)) {
      result.isPublic = isPublic;
    }

    return result;
  }

  stringify(entity: StorageObjectEntity): GrpcStorageObject {
    return _.omit(wrap(entity).toObject(), ['children']) as GrpcStorageObject;
  }
}
