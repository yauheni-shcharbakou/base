// Imported first by every Postgres spec: `@backend/pg` validates its env when the module loads, so
// the default has to be in place before anything pulls it in. The fallback is the database
// `pnpm docker:local` starts.
process.env.DATABASE_URL ??= 'postgresql://admin:password123@localhost:5432';

import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/postgresql';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Its own database, so the suite can wipe it freely without touching the one `pnpm dev` uses.
const E2E_DATABASE = 'storage_e2e';
const MIGRATIONS_DIR = join(__dirname, '../src/migrator/migrations');

// The real migrations rather than a schema generated from the entities: the FK rules the deletion
// paths rely on (`on delete cascade`, `on delete set null`) are what production has, not what the
// metadata would regenerate.
const loadMigrations = () =>
  readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.migration.ts'))
    .sort()
    // A synchronous require through ts-node: MikroORM's own loader imports ESM-style, which
    // cannot read a `.ts` file here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    .flatMap((file) => Object.values(require(join(MIGRATIONS_DIR, file)) as object));

/**
 * Connects to a freshly migrated `storage_e2e`, or returns `undefined` when there is no Postgres —
 * the suite then skips itself instead of failing, like the Redis e2e suites do.
 */
export const startOrm = async (): Promise<MikroORM | undefined> => {
  const orm = await MikroORM.init({
    clientUrl: process.env.DATABASE_URL,
    dbName: E2E_DATABASE,
    entities: [PgFileEntity, PgStorageObjectEntity, PgImageEntity, PgVideoEntity],
    metadataProvider: ReflectMetadataProvider,
    forceUtcTimezone: true,
    // The specs drive the repositories directly, outside any request context.
    allowGlobalContext: true,
    extensions: [Migrator],
    migrations: {
      tableName: 'mikro_orm_migrations',
      migrationsList: loadMigrations(),
      transactional: true,
      allOrNothing: true,
      silent: true,
      // Otherwise `up` drops a `.snapshot-storage_e2e.json` into the working directory.
      snapshot: false,
    },
  });

  // `init` connects lazily; the first statement is where an absent server shows. Only that skips —
  // a server that answers and then fails a migration is a real failure.
  try {
    await orm.schema.ensureDatabase();
  } catch (error) {
    if (!isUnreachable(error)) {
      throw error;
    }

    await orm.close();
    console.warn(`No Postgres at ${process.env.DATABASE_URL} — skipping the storage e2e suite.`);
    return undefined;
  }

  // The whole schema, not the entity tables: the migrations also create tables no entity here
  // describes (the data-task log), and a leftover one fails the next run's `up`.
  await orm.schema.execute('drop schema if exists public cascade; create schema public;');
  await orm.migrator.up();

  return orm;
};

const UNREACHABLE_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH']);

// `localhost` resolves to both families, so a refused connection arrives as an AggregateError.
const isUnreachable = (error: unknown): boolean =>
  UNREACHABLE_CODES.has((error as NodeJS.ErrnoException)?.code) ||
  ((error as AggregateError)?.errors ?? []).some(isUnreachable);
