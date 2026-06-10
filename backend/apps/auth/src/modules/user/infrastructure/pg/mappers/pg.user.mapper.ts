import { PgMapper } from '@backend/pg';
import { NestAuth } from '@backend/proto';
import { ObjectQuery, wrap } from '@mikro-orm/core';
import _ from 'lodash';
import { PgUserEntity } from '../entities/pg.user.entity';

export class PgUserMapper extends PgMapper<PgUserEntity, NestAuth.User, NestAuth.UserQuery> {
  transformQuery({ roles, ...rest }: Partial<NestAuth.UserQuery>): ObjectQuery<PgUserEntity> {
    const result = super.transformQuery(rest);

    if (roles?.length) {
      result.role = { $in: roles };
    }

    return result;
  }

  stringify(entity: PgUserEntity): NestAuth.User {
    return _.omit(wrap(entity).toJSON(), ['hash', 'tempTokens']) as unknown as NestAuth.User;
  }
}
