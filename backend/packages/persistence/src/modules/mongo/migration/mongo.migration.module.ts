import { DynamicModule, Type } from '@nestjs/common';
import { ModelDefinition, MongooseModule } from '@nestjs/mongoose';
import { MigrationTask } from 'interfaces';
import _ from 'lodash';
import { MONGO_TASKS } from 'modules/mongo/migration/mongo.migration.constants';
import {
  MongoMigrationEntity,
  MongoMigrationSchema,
} from 'modules/mongo/migration/mongo.migration.entity';
import { MongoMigrationService } from 'modules/mongo/migration/mongo.migration.service';

export type MongoMigrationModuleParams = {
  imports?: DynamicModule['imports'];
  tasks?: Type<MigrationTask>[];
  entities?: ModelDefinition[];
};

export class MongoMigrationModule {
  static register(params: MongoMigrationModuleParams = {}): DynamicModule {
    const migrationTasks: Type<MigrationTask>[] = params.tasks ?? [];

    return {
      imports: [
        MongooseModule.forFeature([
          ...(params.entities ?? []),
          { name: MongoMigrationEntity.name, schema: MongoMigrationSchema },
        ]),
        ...(params.imports ?? []),
      ],
      providers: [
        {
          provide: MONGO_TASKS,
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
