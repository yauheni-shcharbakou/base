import { PostgresEntity, PostgresModule } from '@/common';
import { MIGRATION_SERVICE, MigrationTask } from '@backend/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { DynamicModule, Type } from '@nestjs/common';
import { Database } from '@packages/common';
import _ from 'lodash';
import { PostgresMigrationCommand } from './infrastructure/cli/postgres.migration.command';
import { PostgresMigrationEntity } from './infrastructure/entities/postgres.migration.entity';
import { PostgresMigrationService } from './infrastructure/services/postgres.migration.service';
import { POSTGRES_MIGRATION_TASKS } from './infrastructure/constants/postgres.migration.tokens';

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
        {
          provide: MIGRATION_SERVICE,
          useClass: PostgresMigrationService,
        },
        PostgresMigrationCommand,
      ],
      module: PostgresMigrationModule,
    };
  }
}
