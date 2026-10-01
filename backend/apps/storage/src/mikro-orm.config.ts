import { definePgConfig } from '@backend/pg';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import { Database } from '@packages/common';

// Read by the MikroORM CLI and by `PgModule.forRoot` alike: the one list of this service's entities.
export default definePgConfig({
  database: Database.STORAGE,
  entities: [PgFileEntity, PgStorageObjectEntity, PgImageEntity, PgVideoEntity],
});
