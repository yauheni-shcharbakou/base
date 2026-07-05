import { PgMapper } from '@backend/pg';
import { NestAuth } from '@backend/proto';
import { ObjectQuery } from '@mikro-orm/core';
import { TempCodeQuery } from '@modules/temp-code/domain/repositories/temp-code.repository';
import _ from 'lodash';
import { PgTempCodeEntity } from '../entities/pg.temp-code.entity';

export class PgTempCodeMapper extends PgMapper<PgTempCodeEntity, NestAuth.TempCode, TempCodeQuery> {
  transformQuery({
    expiredBefore,
    isActive,
    ...rest
  }: Partial<TempCodeQuery>): ObjectQuery<PgTempCodeEntity> {
    const result = super.transformQuery(rest);

    if (expiredBefore) {
      result.expiredAt = { $lte: expiredBefore };
    }

    if (_.isBoolean(isActive)) {
      result.isActive = isActive;
    }

    return result;
  }
}
