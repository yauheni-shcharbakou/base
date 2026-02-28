import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { DynamicModule, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Database } from '@packages/common';
import { PERSISTENCE_SERVICE } from 'common';
import { PostgresEntity } from 'postgres/entities';
import { PostgresRequestInterceptor } from 'postgres/interceptors';
import { PostgresConfig, postgresConfig } from 'postgres/postgres.config';
import { POSTGRES_CONFIG_SERVICE } from 'postgres/postgres.constants';
import { PostgresPersistenceServiceImpl } from 'postgres/services';

type PostgresModuleForRootParams = {
  database: Database;
};

export class PostgresModule {
  static forRoot(params: PostgresModuleForRootParams): DynamicModule {
    return {
      imports: [
        ConfigModule.forFeature(postgresConfig),
        MikroOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService<PostgresConfig>) => {
            return configService.getOrThrow('postgres', { infer: true })(params.database);
          },
          driver: PostgreSqlDriver,
        }),
      ],
      providers: [
        {
          provide: POSTGRES_CONFIG_SERVICE,
          useClass: ConfigService,
        },
        {
          provide: PERSISTENCE_SERVICE,
          useClass: PostgresPersistenceServiceImpl,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: PostgresRequestInterceptor,
        },
      ],
      exports: [POSTGRES_CONFIG_SERVICE, PERSISTENCE_SERVICE],
      global: true,
      module: PostgresModule,
    };
  }

  static forFeature(...entities: Type<PostgresEntity<any>>[]): DynamicModule {
    const ormModule = MikroOrmModule.forFeature(entities);

    return {
      imports: [ormModule],
      exports: [ormModule],
      module: PostgresModule,
    };
  }
}
