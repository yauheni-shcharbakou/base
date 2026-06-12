import { PgEntity, PgModule } from '@/core';
import { MigrationService, MigrationTask } from '@backend/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { DynamicModule, Type } from '@nestjs/common';
import { Database } from '@packages/common';
import _ from 'lodash';
import { PgMigrationCommand } from './interface/cli/pg.migration.command';
import { PG_MIGRATION_TASKS } from './infrastructure/constants/pg.migration.tokens';
import { PgMigrationEntity } from './infrastructure/entities/pg.migration.entity';
import { PgMigrationServiceImpl } from './infrastructure/services/pg.migration.service.impl';

type PgMigrationModuleParams = {
  database: Database;
  imports?: DynamicModule['imports'];
  tasks?: Type<MigrationTask>[];
  entities?: Type<PgEntity<any>>[];
};

export class PgMigrationModule {
  static register(params: PgMigrationModuleParams): DynamicModule {
    const migrationTasks: Type<MigrationTask>[] = params.tasks ?? [];
    const entities = params.entities ?? [];
    const imports = params.imports ?? [];

    return {
      imports: [
        PgModule.forRoot({ database: params.database }),
        MikroOrmModule.forFeature([...entities, PgMigrationEntity]),
        ...imports,
      ],
      providers: [
        {
          provide: PG_MIGRATION_TASKS,
          useValue: migrationTasks,
        },
        ..._.map(migrationTasks, (MigrationTask) => ({
          provide: MigrationTask,
          useClass: MigrationTask,
        })),
        {
          provide: MigrationService,
          useClass: PgMigrationServiceImpl,
        },
        PgMigrationCommand,
      ],
      module: PgMigrationModule,
    };
  }
}
