import { DatabaseRunnerService } from '@backend/common';
import { StorageObjectCleanupUseCase } from '@modules/storage-object/application/use-cases/storage-object.cleanup.use-case';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronStorageObjectScheduler {
  private readonly logger = new Logger(CronStorageObjectScheduler.name);

  constructor(
    private readonly cleanupUseCase: StorageObjectCleanupUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupStorageObjects() {
    try {
      await this.databaseRunnerService.isolatedRun(async () => {
        await this.cleanupUseCase.execute();
      });
    } catch (error) {
      this.logger.error('Storage object cleanup error:', error.message, error.stack);
    }
  }
}
