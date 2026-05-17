import { MigrationService } from '@backend/common';
import { Inject, Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';

type Options = {
  tasks?: boolean;
};

@Command({ name: 'mongo-migration' })
export class MongoMigrationCommand extends CommandRunner {
  private readonly logger = new Logger(MongoMigrationCommand.name);

  constructor(@Inject(MigrationService) private readonly migrationService: MigrationService) {
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
