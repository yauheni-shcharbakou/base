import { DatabaseRunnerService } from '@backend/common';
import { FileCleanupUseCase } from '@modules/file/application/use-cases/file.cleanup.use-case';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FileCronService {
  private readonly logger = new Logger(FileCronService.name);

  constructor(
    private readonly cleanupUseCase: FileCleanupUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupFiles() {
    try {
      await this.databaseRunnerService.isolatedRun(async () => {
        await this.cleanupUseCase.execute();
      });
    } catch (error) {
      this.logger.error('File cleanup error:', error.message, error.stack);
    }
  }
}
