import { MongoMapper } from '@backend/persistence';
import { GrpcUser, GrpcUserQuery } from '@backend/grpc';
import { MongoUserEntity } from 'common/repositories/user/entities/mongo.user.entity';
import _ from 'lodash';
import { QueryFilter } from 'mongoose';

export class MongoUserMapper extends MongoMapper<GrpcUser, MongoUserEntity, GrpcUserQuery> {
  transformQuery({ roles, ...rest }: Partial<GrpcUserQuery>): QueryFilter<MongoUserEntity> {
    const result = super.transformQuery(rest);

    if (roles?.length) {
      result.role = { $in: roles };
    }

    return result;
  }

  stringify(entity: MongoUserEntity): GrpcUser {
    return _.pick(super.stringify(entity), ['id', 'role', 'email', 'createdAt', 'updatedAt']);
  }
}
