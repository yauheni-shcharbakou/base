import { Inject, Injectable, Logger, OnModuleInit, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { MigrationTask } from 'interfaces';
import { MONGO_TASKS } from 'modules/mongo/migration/mongo.migration.constants';
import { MongoMigrationEntity } from 'modules/mongo/migration/mongo.migration.entity';
import { MongoMigrationStatus } from 'modules/mongo/migration/mongo.migration.enums';
import { Model } from 'mongoose';

@Injectable()
export class MongoMigrationService implements OnModuleInit {
  private readonly logger = new Logger(MongoMigrationService.name);

  constructor(
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(MONGO_TASKS) private readonly tasks: Type<MigrationTask>[],
    @InjectModel(MongoMigrationEntity.name)
    private readonly migrationModel: Model<MongoMigrationEntity>,
  ) {}

  async onModuleInit() {
    const completedTasks = await this.migrationModel
      .distinct('name', { status: MongoMigrationStatus.SUCCESS })
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
          .findOneAndUpdate(
            { name },
            { status: MongoMigrationStatus.SUCCESS },
            { new: true, upsert: true },
          )
          .exec();

        this.logger.log(
          `Finished mongo migration ${name} => ${new Date().valueOf() - startTimestamp}ms`,
        );
      } catch (error) {
        this.logger.error(`Mongo migration ${name} failed with error: ${error['message']}`);

        await this.migrationModel
          .findOneAndUpdate(
            { name },
            {
              status: MongoMigrationStatus.FAILED,
              errorMessage: error['message']?.toString(),
              errorStack: error['stack']?.toString(),
            },
            { new: true, upsert: true },
          )
          .exec();

        return;
      }
    }
  }
}
