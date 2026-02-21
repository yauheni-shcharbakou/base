import { MongoMapper } from '@backend/persistence';
import { GrpcUser, GrpcUserQuery } from '@backend/grpc';
import { UserEntity } from 'common/repositories/user/entities/user.entity';
import _ from 'lodash';
import { QueryFilter } from 'mongoose';

export class UserMapper extends MongoMapper<GrpcUser, UserEntity, GrpcUserQuery> {
  transformQuery({ roles, ...rest }: Partial<GrpcUserQuery>): QueryFilter<UserEntity> {
    const result = super.transformQuery(rest);

    if (roles?.length) {
      result.role = { $in: roles };
    }

    return result;
  }

  stringify(entity: UserEntity): GrpcUser {
    return _.pick(super.stringify(entity), ['id', 'role', 'email', 'createdAt', 'updatedAt']);
  }
}
