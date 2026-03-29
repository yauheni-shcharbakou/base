import { MikroOrmModule } from '@mikro-orm/nestjs';
import { DynamicModule, Type } from '@nestjs/common';
import { Database } from '@packages/common';
import { MigrationTask } from 'common/interfaces';
import _ from 'lodash';
import { PostgresEntity } from 'postgres/entities';
import { PostgresMigrationCommand } from 'postgres/modules/migration/postgres.migration.command';
import { POSTGRES_MIGRATION_TASKS } from 'postgres/modules/migration/postgres.migration.constants';
import { PostgresMigrationEntity } from 'postgres/modules/migration/postgres.migration.entity';
import { PostgresMigrationService } from 'postgres/modules/migration/postgres.migration.service';
import { PostgresModule } from 'postgres/postgres.module';

type PostgresMigrationModuleParams = {
  database: Database;
  imports?: DynamicModule['imports'];
  tasks?: Type<MigrationTask>[];
  entities?: Type<PostgresEntity<any>>[];
};

export class PostgresMigrationModule {
  static register(params: PostgresMigrationModuleParams): DynamicModule {
    const migrationTasks: Type<MigrationTask>[] = params.tasks ?? [];
    const entities = params.entities ?? [];
    const imports = params.imports ?? [];

    return {
      imports: [
        PostgresModule.forRoot({ database: params.database }),
        MikroOrmModule.forFeature([...entities, PostgresMigrationEntity]),
        ...imports,
      ],
      providers: [
        {
          provide: POSTGRES_MIGRATION_TASKS,
          useValue: migrationTasks,
        },
        ..._.map(migrationTasks, (MigrationTask) => ({
          provide: MigrationTask,
          useClass: MigrationTask,
        })),
        PostgresMigrationService,
        PostgresMigrationCommand,
      ],
      module: PostgresMigrationModule,
    };
  }
}
