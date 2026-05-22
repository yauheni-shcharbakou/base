import { PgMapper } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { ObjectQuery } from '@mikro-orm/core';
import { PgVideoEntity } from '../entities/pg.video.entity';

export class PgVideoMapper extends PgMapper<
  PgVideoEntity,
  NestStorage.Video,
  NestStorage.VideoQuery
> {
  transformQuery({
    providerIds,
    ...rest
  }: Partial<NestStorage.VideoQuery>): ObjectQuery<PgVideoEntity> {
    const result = super.transformQuery(rest);

    if (providerIds?.length) {
      result.providerId = { $in: providerIds };
    }

    return result;
  }
}
