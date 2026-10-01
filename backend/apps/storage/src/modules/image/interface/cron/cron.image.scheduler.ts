import { DatabaseRunnerService } from '@backend/common';
import { ImageSweepPreviewsUseCase } from '@modules/image/application/use-cases/image.sweep-previews.use-case';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronImageScheduler {
  private readonly logger = new Logger(CronImageScheduler.name);

  constructor(
    private readonly sweepPreviewsUseCase: ImageSweepPreviewsUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepPreviews() {
    try {
      await this.databaseRunnerService.isolatedRun(async () => {
        await this.sweepPreviewsUseCase.execute();
      });
    } catch (error) {
      this.logger.error('Image preview sweep error:', error.message, error.stack);
    }
  }
}
