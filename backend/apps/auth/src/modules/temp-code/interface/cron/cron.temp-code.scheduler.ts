import { DatabaseRunnerService } from '@backend/common';
import { TempCodeDeactivateExpiredUseCase } from '@modules/temp-code/application/use-cases/temp-code.deactivate-expired.use-case';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronTempCodeScheduler {
  private readonly logger = new Logger(CronTempCodeScheduler.name);

  constructor(
    private readonly deactivateExpiredUseCase: TempCodeDeactivateExpiredUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async deactivateExpired() {
    try {
      await this.databaseRunnerService.isolatedRun(async () => {
        await this.deactivateExpiredUseCase.execute();
      });
    } catch (error) {
      this.logger.error('TempCode deactivation error:', error.message, error.stack);
    }
  }
}
