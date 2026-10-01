import { DatabaseRunnerService } from '@backend/common';
import { AuthSessionDeleteExpiredUseCase } from '@modules/auth/application/use-cases/auth.session.delete-expired.use-case';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronAuthSessionScheduler {
  private readonly logger = new Logger(CronAuthSessionScheduler.name);

  constructor(
    private readonly deleteExpiredUseCase: AuthSessionDeleteExpiredUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async deleteExpired() {
    try {
      await this.databaseRunnerService.isolatedRun(async () => {
        await this.deleteExpiredUseCase.execute();
      });
    } catch (error) {
      this.logger.error('Expired session cleanup error:', error.message, error.stack);
    }
  }
}
