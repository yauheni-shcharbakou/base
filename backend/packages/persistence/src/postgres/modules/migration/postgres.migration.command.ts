import { MikroORM } from '@mikro-orm/postgresql';
import { Inject, Logger } from '@nestjs/common';
import _ from 'lodash';
import { Command, CommandRunner, Option } from 'nest-commander';
import { PostgresMigrationService } from 'postgres/modules/migration/postgres.migration.service';

type Options = {
  up?: boolean;
  new?: boolean | string;
  initial?: boolean;
  tasks?: boolean;
};

@Command({ name: 'postgres-migration' })
export class PostgresMigrationCommand extends CommandRunner {
  private readonly logger = new Logger(PostgresMigrationCommand.name);

  constructor(
    @Inject(MikroORM) private readonly orm: MikroORM,
    @Inject(PostgresMigrationService) private readonly migrationService: PostgresMigrationService,
  ) {
    super();
  }

  async run(passedParams: string[], options: Options = {}): Promise<void> {
    try {
      const migrator = this.orm.migrator;

      if (_.isEmpty(options)) {
        // without args: sql & custom tasks by default
        await migrator.up();
        this.logger.log('Sql migrations applied');
        await this.migrationService.runTasks();
        return;
      }

      if (options.initial) {
        const res = await migrator.createInitialMigration();
        this.logger.log(`Sql initial migration created: ${res.fileName}`);
        return;
      }

      if (options.new) {
        const name = _.isString(options.new) ? options.new : undefined;
        const res = await migrator.createMigration(undefined, false, false, name);
        this.logger.log(`Sql migration created: ${res.fileName}`);
        return;
      }

      if (options.up) {
        await migrator.up();
        this.logger.log('Sql migrations applied');
      }

      if (options.tasks) {
        await this.migrationService.runTasks();
      }
    } catch (error) {
      this.logger.error('Migration command error', error['message'], error['stack']);
    }
  }

  @Option({ flags: '-u, --up' })
  parseUp() {
    return true;
  }

  @Option({ flags: '-n, --new [new]' })
  parseNew(name: string) {
    return name || true;
  }

  @Option({ flags: '-i, --initial' })
  parseInitial() {
    return true;
  }

  @Option({ flags: '-t, --tasks' })
  parseTasks() {
    return true;
  }
}
