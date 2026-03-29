import { Migrator } from '@mikro-orm/migrations';
import { MikroOrmModuleOptions } from '@mikro-orm/nestjs/typings';
import { MigrationsOptions, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { DatabaseValidationSchema, NodeValidationSchema, validateEnv } from '@packages/common';
import { dotCase } from 'change-case-all';

const env = validateEnv({
  ...NodeValidationSchema,
  ...DatabaseValidationSchema,
});

export const postgresConfig = () =>
  ({
    postgres: (dbName: string): Omit<MikroOrmModuleOptions<PostgreSqlDriver>, 'contextName'> => {
      const migrations: MigrationsOptions = {
        tableName: 'mikro_orm_migrations',
        path: 'dist/migrator/migrations',
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
      };

      if (env.NODE_ENV !== 'production') {
        migrations.pathTs = 'src/migrator/migrations';
      }

      return {
        schema: 'public',
        clientUrl: env.DATABASE_URL,
        autoLoadEntities: true,
        driver: PostgreSqlDriver,
        dbName,
        forceUtcTimezone: true,
        schemaGenerator: {
          disableForeignKeys: false,
          createForeignKeyConstraints: true,
        },
        migrations,
        extensions: [Migrator],
      };
    },
  }) as const;

export type PostgresConfig = ReturnType<typeof postgresConfig>;
