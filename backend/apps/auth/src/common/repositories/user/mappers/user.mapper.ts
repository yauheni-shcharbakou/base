import { PostgresMapper, PostgresSorting } from '@backend/persistence';
import { GrpcCrudSorter, GrpcUser, GrpcUserQuery } from '@backend/grpc';
import { ObjectQuery, wrap } from '@mikro-orm/core';
import { UserEntity } from 'common/repositories/user/entities/user.entity';
import _ from 'lodash';

export class UserMapper extends PostgresMapper<GrpcUser, UserEntity, GrpcUserQuery> {
  transformQuery({ roles, ...rest }: Partial<GrpcUserQuery>): ObjectQuery<UserEntity> {
    const result = super.transformQuery(rest);

    if (roles?.length) {
      result.role = { $in: roles };
    }

    return result;
  }

  stringify(entity: UserEntity): GrpcUser {
    return _.omit(wrap(entity).toJSON() as UserEntity, ['hash']);
  }
}
