import { Inject, Logger } from '@nestjs/common';
import { MongoMigrationService } from 'mongo/modules/migration/mongo.migration.service';
import { Command, CommandRunner, Option } from 'nest-commander';

type Options = {
  tasks?: boolean;
};

@Command({ name: 'mongo-migration' })
export class MongoMigrationCommand extends CommandRunner {
  private readonly logger = new Logger(MongoMigrationCommand.name);

  constructor(
    @Inject(MongoMigrationService) private readonly migrationService: MongoMigrationService,
  ) {
    super();
  }

  async run(passedParams: string[], options: Options = {}): Promise<void> {
    try {
      await this.migrationService.runTasks();
    } catch (error) {
      this.logger.error('Migration command error', error['message'], error['stack']);
    }
  }

  @Option({ flags: '-t, --tasks' })
  parseTasks() {
    return true;
  }
}
