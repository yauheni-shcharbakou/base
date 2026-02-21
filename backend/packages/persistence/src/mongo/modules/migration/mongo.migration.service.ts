import { Inject, Injectable, Logger, OnModuleInit, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { CommonDatabaseEntity } from '@packages/common';
import { MigrationStatus, MigrationTask } from 'common';
import { MONGO_MIGRATION_TASKS } from 'mongo/modules/migration/mongo.migration.constants';
import { MongoMigrationEntity } from 'mongo/modules/migration/mongo.migration.entity';
import { Model } from 'mongoose';

@Injectable()
export class MongoMigrationService implements OnModuleInit {
  private readonly logger = new Logger(MongoMigrationService.name);

  constructor(
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(MONGO_MIGRATION_TASKS) private readonly tasks: Type<MigrationTask>[],
    @InjectModel(CommonDatabaseEntity.MIGRATION)
    private readonly migrationModel: Model<MongoMigrationEntity>,
  ) {}

  async onModuleInit() {
    const completedTasks = await this.migrationModel
      .distinct('name', { status: MigrationStatus.SUCCESS })
      .exec();

    const completedTasksSet = new Set(completedTasks);

    for (const MigrationTask of this.tasks) {
      const name = MigrationTask.name;

      if (completedTasksSet.has(name)) {
        continue;
      }

      const instance = this.moduleRef.get(MigrationTask);
      const startTimestamp = new Date().valueOf();

      try {
        this.logger.log(`Run mongo migration ${name}`);
        await instance.up();

        await this.migrationModel
          .updateOne({ name }, { status: MigrationStatus.SUCCESS }, { upsert: true })
          .exec();

        this.logger.log(
          `Finished mongo migration ${name} => ${new Date().valueOf() - startTimestamp}ms`,
        );
      } catch (error) {
        this.logger.error(`Mongo migration ${name} failed with error: ${error['message']}`);

        await this.migrationModel
          .updateOne(
            { name },
            {
              status: MigrationStatus.FAILED,
              errorMessage: error['message']?.toString(),
              errorStack: error['stack']?.toString(),
            },
            { upsert: true },
          )
          .exec();

        return;
      }
    }
  }
}
