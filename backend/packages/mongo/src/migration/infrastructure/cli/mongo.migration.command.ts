import { Inject, Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { MIGRATION_SERVICE, type MigrationService } from '@backend/common';

type Options = {
  tasks?: boolean;
};

@Command({ name: 'mongo-migration' })
export class MongoMigrationCommand extends CommandRunner {
  private readonly logger = new Logger(MongoMigrationCommand.name);

  constructor(@Inject(MIGRATION_SERVICE) private readonly migrationService: MigrationService) {
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
