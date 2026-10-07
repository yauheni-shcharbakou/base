import { PgMapper } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import {
  backingFileStatusFilter,
  isPlacedFilter,
} from '@common/infrastructure/pg/factories/pg.media.filters';
import { serialize } from '@mikro-orm/core';

/**
 * `ImageQuery` (`id`/`ids`/`file`/`userId`) is fully covered by the base `PgMapper.transformQuery`,
 * so there is no override. A list also filters on `isPlaced` and on the backing file's
 * `uploadStatus`.
 */
export class PgImageMapper extends PgMapper<
  PgImageEntity,
  NestStorage.Image,
  NestStorage.ImageQuery
> {
  protected readonly computedFilters = {
    isPlaced: isPlacedFilter<PgImageEntity>(),
    uploadStatus: backingFileStatusFilter<PgImageEntity>(),
  };

  // The contract (`Image`, `ImagePopulated`) holds the file and nothing past it. `toJSON` follows
  // every loaded relation, and a storage object leads to its folder and, through the `children` the
  // unit of work fills, to every sibling: a batch placed in a folder the EntityManager holds cost
  // n² (30 s for a hundred images). What is not populated stays a key, what is excluded is never
  // visited.
  stringify(entity: PgImageEntity): NestStorage.Image {
    return serialize(entity, {
      populate: ['file'],
      // `file` is typed as the proto `File`, which has no relations, so the paths past it do not
      // type-check; the metadata does have them.
      exclude: ['storageObject', 'file.storageObject', 'file.image', 'file.video'] as never[],
    });
  }
}
