import { PgMapper } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import { ObjectQuery } from '@mikro-orm/core';

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
