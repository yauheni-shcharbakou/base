import { PgMapper } from '@backend/pg';
import { NestAuth } from '@backend/proto';
import { ObjectQuery } from '@mikro-orm/core';
import { PgUserEntity } from '../entities/pg.user.entity';

export class PgUserMapper extends PgMapper<PgUserEntity, NestAuth.User, NestAuth.UserQuery> {
  protected readonly exclude = ['hash', 'tempCodes'];

  transformQuery({ roles, ...rest }: Partial<NestAuth.UserQuery>): ObjectQuery<PgUserEntity> {
    const result = super.transformQuery(rest);

    if (roles?.length) {
      result.role = { $in: roles };
    }

    return result;
  }
}
