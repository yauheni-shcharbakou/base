import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, MigrationsOptions } from '@mikro-orm/postgresql';
import { Type } from '@nestjs/common';
import {
  Database,
  DatabaseValidationSchema,
  NodeValidationSchema,
  validateEnv,
} from '@packages/common';
import { dotCase } from 'change-case-all';
import { PgEntity } from '../entities';

const env = validateEnv({
  ...NodeValidationSchema,
  ...DatabaseValidationSchema,
});

type DefinePgConfigParams = {
  database: Database;
  entities: Type<PgEntity<any>>[];
};

// These CLI commands rewrite the snapshot from the database they ran against, constraints written
// in raw SQL included (storage's owner-scoped parent key). The entities cannot express those, so the
// next `migration:create` would drop them. Only creating a migration may move the snapshot.
const SNAPSHOT_REWRITING_COMMANDS = ['migration:up', 'migration:down', 'migration:fresh'];

/**
 * A service's whole MikroORM configuration. Its `src/mikro-orm.config.ts` default-exports the
 * result, so the MikroORM CLI and `PgModule.forRoot` read one and the same object — including the
 * entity list, which therefore has a single owner.
 */
export const definePgConfig = ({ database, entities }: DefinePgConfigParams) => {
  const migrations: MigrationsOptions = {
    tableName: 'mikro_orm_migrations',
    path: 'dist/migrations',
    glob: '!(*.d).{js,ts}',
    transactional: true,
    allOrNothing: true,
    snapshot: !SNAPSHOT_REWRITING_COMMANDS.some((command) => process.argv.includes(command)),
    fileName: (timestamp, name) => {
      const parts = [timestamp];

      if (name) {
        parts.push(name);
      }

      parts.push('migration');
      return dotCase(parts.join('_'));
    },
  };

  // Production runs the compiled config and has no TypeScript loader to read sources with.
  if (env.NODE_ENV !== 'production') {
    migrations.pathTs = 'src/migrations';
  }

  return defineConfig({
    schema: 'public',
    clientUrl: env.DATABASE_URL,
    dbName: database,
    entities,
    forceUtcTimezone: true,
    schemaGenerator: {
      disableForeignKeys: false,
      createForeignKeyConstraints: true,
    },
    migrations,
    extensions: [Migrator],
    metadataProvider: ReflectMetadataProvider,
  });
};

export type PgOrmConfig = ReturnType<typeof definePgConfig>;
