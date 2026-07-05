import { PgMapper } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';

/**
 * Thin named mapper for image rows. `ImageQuery` (`id`/`ids`/`file`/`userId`) is fully covered by the
 * base `PgMapper.transformQuery`, so there is no override — this exists for symmetry with
 * `PgFileMapper` / `PgVideoMapper` / `PgStorageObjectMapper`.
 */
export class PgImageMapper extends PgMapper<
  PgImageEntity,
  NestStorage.Image,
  NestStorage.ImageQuery
> {}
