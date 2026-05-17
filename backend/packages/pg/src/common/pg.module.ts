import { DatabaseRunnerService } from '@backend/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { DynamicModule, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Database } from '@packages/common';
import { PgDatabaseRunnerServiceImpl, PgEntity, PgRequestInterceptor } from './infrastructure';
import { PgConfig, pgConfig } from './infrastructure/configs';

type PgModuleForRootParams = {
  database: Database;
};

export class PgModule {
  static forRoot(params: PgModuleForRootParams): DynamicModule {
    return {
      imports: [
        ConfigModule.forFeature(pgConfig),
        MikroOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService<PgConfig>) => {
            return configService.getOrThrow('postgres', { infer: true })(params.database);
          },
          driver: PostgreSqlDriver,
        }),
      ],
      providers: [
        {
          provide: DatabaseRunnerService,
          useClass: PgDatabaseRunnerServiceImpl,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: PgRequestInterceptor,
        },
      ],
      exports: [DatabaseRunnerService],
      global: true,
      module: PgModule,
    };
  }

  static forFeature(...entities: Type<PgEntity<any>>[]): DynamicModule {
    const ormModule = MikroOrmModule.forFeature(entities);

    return {
      imports: [ormModule],
      exports: [ormModule],
      module: PgModule,
    };
  }
}
