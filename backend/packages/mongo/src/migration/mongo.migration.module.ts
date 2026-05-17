import { MongoEntity, MongoModule, convertEntitiesToMongoDefinitions } from '@/common';
import { MigrationService, MigrationTask } from '@backend/common';
import { DynamicModule, Type } from '@nestjs/common';
import { ModelDefinition, MongooseModule } from '@nestjs/mongoose';
import { CommonDatabaseEntity, Database } from '@packages/common';
import _ from 'lodash';
import { MongoMigrationCommand } from './infrastructure/cli/mongo.migration.command';
import { MONGO_MIGRATION_TASKS } from './infrastructure/constants/mongo.migration.tokens';
import { MongoMigrationSchema } from './infrastructure/entities/mongo.migration.entity';
import { MongoMigrationServiceImpl } from './infrastructure/services/mongo.migration.service.impl';

type MongoMigrationModuleParams = {
  database: Database;
  imports?: DynamicModule['imports'];
  tasks?: Type<MigrationTask>[];
  entities?: Type<MongoEntity>[];
};

export class MongoMigrationModule {
  static register(params: MongoMigrationModuleParams): DynamicModule {
    const migrationTasks: Type<MigrationTask>[] = params.tasks ?? [];
    const entities = params.entities ?? [];
    const imports = params.imports ?? [];

    const definitions: ModelDefinition[] = convertEntitiesToMongoDefinitions(entities);

    return {
      imports: [
        MongoModule.forRoot({ database: params.database }),
        MongooseModule.forFeature([
          ...definitions,
          { name: CommonDatabaseEntity.MIGRATION, schema: MongoMigrationSchema },
        ]),
        ...imports,
      ],
      providers: [
        {
          provide: MONGO_MIGRATION_TASKS,
          useValue: migrationTasks,
        },
        ..._.map(migrationTasks, (MigrationTask) => ({
          provide: MigrationTask,
          useClass: MigrationTask,
        })),
        {
          provide: MigrationService,
          useClass: MongoMigrationServiceImpl,
        },
        MongoMigrationCommand,
      ],
      module: MongoMigrationModule,
    };
  }
}
