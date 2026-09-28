// Imported first by every Postgres spec: `@backend/pg` validates its env when the module loads, so
// the default has to be in place before anything pulls it in. The fallback is the database
// `pnpm docker:local` starts.
process.env.DATABASE_URL ??= 'postgresql://admin:password123@localhost:5432';

import ormConfig from '@/mikro-orm.config';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/postgresql';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Its own database, so the suite can wipe it freely without touching the one `pnpm dev` uses.
const E2E_DATABASE = 'storage_e2e';
const MIGRATIONS_DIR = join(__dirname, '../src/migrations');

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

export interface StartOrmOptions {
  /**
   * Suffix of the spec's own database. `node --test` runs spec files in parallel processes, and each
   * one drops and re-migrates its schema, so two specs sharing a database wipe each other's tables.
   */
  database?: string;
  /** Receives every statement the ORM sends — for specs that assert how many a call costs. */
  onQuery?: (message: string) => void;
}

/**
 * Connects to a freshly migrated `storage_e2e[_<database>]`, or returns `undefined` when there is no
 * Postgres — the suite then skips itself instead of failing, like the Redis e2e suites do.
 */
export const startOrm = async ({ database, onQuery }: StartOrmOptions = {}): Promise<
  MikroORM | undefined
> => {
  const orm = await MikroORM.init({
    clientUrl: process.env.DATABASE_URL,
    dbName: database ? `${E2E_DATABASE}_${database}` : E2E_DATABASE,
    entities: ormConfig.entities,
    metadataProvider: ReflectMetadataProvider,
    forceUtcTimezone: true,
    // The specs drive the repositories directly, outside any request context.
    allowGlobalContext: true,
    // Only the `query` namespace, so each call of the listener is exactly one statement.
    ...(onQuery ? { debug: ['query' as const], logger: onQuery } : {}),
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
    await orm.close();

    if (!isUnreachable(error)) {
      throw error;
    }

    // CI starts every server, so there a skip can only mean a broken environment.
    if (process.env.E2E_REQUIRE_SERVERS === '1') {
      throw Object.assign(
        new Error(
          `No Postgres at ${process.env.DATABASE_URL}, and E2E_REQUIRE_SERVERS forbids skipping.`,
        ),
        { cause: error },
      );
    }

    console.warn(`No Postgres at ${process.env.DATABASE_URL} — skipping the storage e2e suite.`);
    return undefined;
  }

  // The whole schema, not the entity tables: the migrator's own `mikro_orm_migrations` is no
  // entity's table, and a row left in it makes the next run's `up` skip what it should recreate.
  await orm.schema.execute('drop schema if exists public cascade; create schema public;');
  await orm.migrator.up();

  return orm;
};

const UNREACHABLE_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH']);

// `localhost` resolves to both families, so a refused connection arrives as an AggregateError.
const isUnreachable = (error: unknown): boolean =>
  UNREACHABLE_CODES.has((error as NodeJS.ErrnoException)?.code) ||
  ((error as AggregateError)?.errors ?? []).some(isUnreachable);
