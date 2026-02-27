import { MikroORM, RequestContext, wrap } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MigrationService, MigrationStatus, MigrationTask } from 'common';
import _ from 'lodash';
import { POSTGRES_MIGRATION_TASKS } from 'postgres/modules/migration/postgres.migration.constants';
import { PostgresMigrationEntity } from 'postgres/modules/migration/postgres.migration.entity';

@Injectable()
export class PostgresMigrationService implements MigrationService {
  private readonly logger = new Logger(PostgresMigrationService.name);

  constructor(
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(POSTGRES_MIGRATION_TASKS) private readonly tasks: Type<MigrationTask>[],
    @Inject(MikroORM) private readonly orm: MikroORM,
  ) {}

  private async findOrCreate(
    em: EntityManager,
    name: string,
    updateData: Partial<PostgresMigrationEntity>,
  ) {
    let migration = await em.findOne(PostgresMigrationEntity, { name });

    if (!migration) {
      migration = em.create(PostgresMigrationEntity, { name });
      em.persist(migration);
    }

    wrap(migration).assign(updateData);
    await em.flush();
  }

  async runTasks() {
    // try {
    //   await this.orm.migrator.createInitialMigration();
    // } catch (e) {}
    //
    // await this.orm.migrator.up();

    await RequestContext.create(this.orm.em, async () => {
      const em = this.orm.em as EntityManager;

      const completedTasks = await em.find(PostgresMigrationEntity, {
        status: MigrationStatus.SUCCESS,
      });

      const completedTasksSet = new Set(_.map(completedTasks, 'name'));

      for (const MigrationTask of this.tasks) {
        const name = MigrationTask.name;

        if (completedTasksSet.has(name)) {
          continue;
        }

        const instance = this.moduleRef.get(MigrationTask);
        const startTimestamp = new Date().valueOf();

        try {
          this.logger.log(`Run postgres migration ${name}`);
          await instance.up();
          await this.findOrCreate(em, name, { status: MigrationStatus.SUCCESS });

          this.logger.log(
            `Finished postgres migration ${name} => ${new Date().valueOf() - startTimestamp}ms`,
          );
        } catch (error) {
          this.logger.error(`Postgres migration ${name} failed with error: ${error['message']}`);

          await this.findOrCreate(em, name, {
            status: MigrationStatus.FAILED,
            errorMessage: error['message']?.toString(),
            errorStack: error['stack']?.toString(),
          });

          return;
        }
      }
    });
  }
}
