import { MongoMapper } from '@backend/persistence';
import { GrpcStorageObject, GrpcStorageObjectQuery } from '@backend/grpc';
import { MongoStorageObjectEntity } from 'common/repositories/storage-object/entities/mongo.storage-object.entity';
import _ from 'lodash';
import { QueryFilter } from 'mongoose';

export class MongoStorageObjectMapper extends MongoMapper<
  GrpcStorageObject,
  MongoStorageObjectEntity,
  GrpcStorageObjectQuery
> {
  transformQuery({
    isPublic,
    ...rest
  }: Partial<GrpcStorageObjectQuery>): QueryFilter<MongoStorageObjectEntity> {
    const result = super.transformQuery(rest);

    if (_.isBoolean(isPublic)) {
      result.isPublic = isPublic;
    }

    return result;
  }
}
