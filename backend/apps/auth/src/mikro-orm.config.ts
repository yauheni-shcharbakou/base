import { definePgConfig } from '@backend/pg';
import { PgAuthSessionEntity } from '@modules/auth/infrastructure/pg/entities/pg.auth-session.entity';
import { PgTempCodeEntity } from '@modules/temp-code/infrastructure/pg/entities/pg.temp-code.entity';
import { PgUserEntity } from '@modules/user/infrastructure/pg/entities/pg.user.entity';
import { Database } from '@packages/common';

// Read by the MikroORM CLI and by `PgModule.forRoot` alike: the one list of this service's entities.
export default definePgConfig({
  database: Database.AUTH,
  entities: [PgUserEntity, PgTempCodeEntity, PgAuthSessionEntity],
});
