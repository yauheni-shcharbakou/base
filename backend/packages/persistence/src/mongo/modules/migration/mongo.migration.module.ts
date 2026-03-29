import { DynamicModule, Type } from '@nestjs/common';
import { ModelDefinition, MongooseModule } from '@nestjs/mongoose';
import { CommonDatabaseEntity, Database } from '@packages/common';
import { MigrationTask } from 'common/interfaces';
import _ from 'lodash';
import { MongoEntity } from 'mongo/entities';
import { convertEntitiesToMongoDefinitions } from 'mongo/helpers';
import { MongoMigrationCommand } from 'mongo/modules/migration/mongo.migration.command';
import { MONGO_MIGRATION_TASKS } from 'mongo/modules/migration/mongo.migration.constants';
import { MongoMigrationSchema } from 'mongo/modules/migration/mongo.migration.entity';
import { MongoMigrationService } from 'mongo/modules/migration/mongo.migration.service';
import { MongoModule } from 'mongo/mongo.module';

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
        MongoMigrationService,
        MongoMigrationCommand,
      ],
      module: MongoMigrationModule,
    };
  }
}
