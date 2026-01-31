import { MongoMapper } from '@backend/persistence';
import { User, UserQuery } from '@backend/grpc';
import { UserEntity } from 'common/entities/user.entity';
import _ from 'lodash';
import { QueryFilter } from 'mongoose';

export class UserMapper extends MongoMapper<User, UserEntity, UserQuery> {
  transformQuery({ roles, ...rest }: Partial<UserQuery>): QueryFilter<UserEntity> {
    const result = super.transformQuery(rest);

    if (roles?.length) {
      result.role = { $in: roles };
    }

    return result;
  }

  stringify(entity: UserEntity): User {
    return _.pick(super.stringify(entity), ['id', 'role', 'email', 'createdAt', 'updatedAt']);
  }
}
