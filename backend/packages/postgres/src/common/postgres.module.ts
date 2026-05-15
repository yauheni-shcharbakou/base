import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { DynamicModule, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Database } from '@packages/common';
import {
  PostgresRequestInterceptor,
  PostgresEntity,
  PostgresDatabaseRunnerServiceImpl,
} from './infrastructure';
import { DATABASE_RUNNER_SERVICE } from '@backend/common';
import { postgresConfig, PostgresConfig } from './infrastructure/configs';

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
          provide: DATABASE_RUNNER_SERVICE,
          useClass: PostgresDatabaseRunnerServiceImpl,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: PostgresRequestInterceptor,
        },
      ],
      exports: [DATABASE_RUNNER_SERVICE],
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
