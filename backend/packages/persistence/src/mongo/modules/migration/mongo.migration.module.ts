import { DynamicModule, Type } from '@nestjs/common';
import { ModelDefinition, MongooseModule } from '@nestjs/mongoose';
import { CommonDatabaseEntity } from '@packages/common';
import { MigrationTask } from 'common/interfaces';
import _ from 'lodash';
import { MongoEntity } from 'mongo/entities';
import { convertEntitiesToMongoDefinitions } from 'mongo/helpers';
import { MONGO_MIGRATION_TASKS } from 'mongo/modules/migration/mongo.migration.constants';
import { MongoMigrationSchema } from 'mongo/modules/migration/mongo.migration.entity';
import { MongoMigrationService } from 'mongo/modules/migration/mongo.migration.service';

export type MongoMigrationModuleParams = {
  imports?: DynamicModule['imports'];
  tasks?: Type<MigrationTask>[];
  entities?: Type<MongoEntity>[];
};

export class MongoMigrationModule {
  static register(params: MongoMigrationModuleParams = {}): DynamicModule {
    const migrationTasks: Type<MigrationTask>[] = params.tasks ?? [];
    const definitions: ModelDefinition[] = convertEntitiesToMongoDefinitions(params.entities);

    return {
      imports: [
        MongooseModule.forFeature([
          ...definitions,
          { name: CommonDatabaseEntity.MIGRATION, schema: MongoMigrationSchema },
        ]),
        ...(params.imports ?? []),
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
        MongoMigrationService,
      ],
      exports: [MongooseModule, MongoMigrationService],
      module: MongoMigrationModule,
    };
  }
}
