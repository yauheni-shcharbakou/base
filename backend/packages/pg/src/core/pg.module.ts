import { DatabaseRunnerService } from '@backend/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { DynamicModule, Type } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PgDatabaseRunnerServiceImpl, PgEntity } from './infrastructure';
import { PgOrmConfig } from './infrastructure/configs';
import { PgRequestInterceptor } from './interface';

export class PgModule {
  /**
   * `config` is the service's `src/mikro-orm.config.ts`, the file the MikroORM CLI reads. There is
   * no `autoLoadEntities`, so both discover the same entities: the listed ones and whatever their
   * relations reach. One registered through `forFeature` but reached by neither fails the bootstrap,
   * rather than being left out of the next `migration:create`.
   */
  static forRoot(config: PgOrmConfig): DynamicModule {
    return {
      imports: [MikroOrmModule.forRoot(config)],
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
