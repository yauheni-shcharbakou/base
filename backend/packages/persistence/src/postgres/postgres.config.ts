import { Migrator } from '@mikro-orm/migrations';
import { MikroOrmModuleOptions } from '@mikro-orm/nestjs/typings';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { DatabaseValidationSchema, validateEnv } from '@packages/common';
import { dotCase } from 'change-case-all';

const env = validateEnv(DatabaseValidationSchema);

export const postgresConfig = () =>
  ({
    postgres: (dbName: string): Omit<MikroOrmModuleOptions<PostgreSqlDriver>, 'contextName'> => {
      return {
        clientUrl: env.DATABASE_URL,
        autoLoadEntities: true,
        driver: PostgreSqlDriver,
        dbName,
        forceUtcTimezone: true,
        schemaGenerator: {
          disableForeignKeys: false,
          createForeignKeyConstraints: true,
        },
        migrations: {
          path: 'dist/migrator/migrations',
          pathTs: 'src/migrator/migrations',
          glob: '!(*.d).{js,ts}',
          transactional: true,
          allOrNothing: true,
          fileName: (timestamp, name) => {
            const parts = [timestamp];

            if (name) {
              parts.push(name);
            }

            parts.push('migration');
            return dotCase(parts.join('_'));
          },
        },
        extensions: [Migrator],
      };
    },
  }) as const;

export type PostgresConfig = ReturnType<typeof postgresConfig>;
