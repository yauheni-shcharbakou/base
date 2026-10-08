import { PgMapper } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import {
  backingFileStatusFilter,
  isPlacedFilter,
} from '@common/infrastructure/pg/factories/pg.media.filters';

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

  // The contract (`Image`, `ImagePopulated`) holds the file and nothing past it. Never a storage
  // object, which leads to its folder and every sibling there.
  protected readonly populate = ['file'];
  protected readonly exclude = ['storageObject', 'file.storageObject', 'file.image', 'file.video'];
}
