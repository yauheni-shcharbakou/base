import { PostgresMapper } from '@backend/persistence';
import { GrpcTempCode } from '@backend/grpc';
import { ObjectQuery } from '@mikro-orm/core';
import { TempCodeEntity } from 'common/repositories/temp-code/entities/temp-code.entity';
import { TempCodeQuery } from 'common/repositories/temp-code/temp-code.repository';
import _ from 'lodash';

export class TempCodeMapper extends PostgresMapper<TempCodeEntity, GrpcTempCode, TempCodeQuery> {
  transformQuery({
    expiredBefore,
    isActive,
    ...rest
  }: Partial<TempCodeQuery>): ObjectQuery<TempCodeEntity> {
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
