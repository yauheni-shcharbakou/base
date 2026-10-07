import { PgMapper } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import {
  backingFileStatusFilter,
  isPlacedFilter,
} from '@common/infrastructure/pg/factories/pg.media.filters';
import { ObjectQuery, serialize } from '@mikro-orm/core';

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

  // As in the image mapper: the contract (`Video`, `VideoPopulated`) holds the file and nothing past
  // it, and a serialized storage object walks its whole folder (60 s for a hundred videos placed in
  // one the EntityManager holds). Excluded paths are never visited.
  stringify(entity: PgVideoEntity): NestStorage.Video {
    return serialize(entity, {
      populate: ['file'],
      // `file` is typed as the proto `File`, which has no relations, so the paths past it do not
      // type-check; the metadata does have them.
      exclude: ['storageObject', 'file.storageObject', 'file.image', 'file.video'] as never[],
    });
  }
}
