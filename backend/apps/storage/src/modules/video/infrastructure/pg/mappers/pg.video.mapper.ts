import { PgMapper } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import {
  backingFileStatusFilter,
  isPlacedFilter,
} from '@common/infrastructure/pg/factories/pg.media.filters';
import { ObjectQuery } from '@mikro-orm/core';

export class PgVideoMapper extends PgMapper<
  PgVideoEntity,
  NestStorage.Video,
  NestStorage.VideoQuery
> {
  // A list also filters on `isPlaced` and on the backing file's `uploadStatus`.
  protected readonly computedFilters = {
    isPlaced: isPlacedFilter<PgVideoEntity>(),
    uploadStatus: backingFileStatusFilter<PgVideoEntity>(),
  };

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
