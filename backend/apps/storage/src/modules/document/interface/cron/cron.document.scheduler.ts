import { DatabaseRunnerService } from '@backend/common';
import { DocumentSweepPreviewsUseCase } from '@modules/document/application/use-cases/document.sweep-previews.use-case';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronDocumentScheduler {
  private readonly logger = new Logger(CronDocumentScheduler.name);

  constructor(
    private readonly sweepPreviewsUseCase: DocumentSweepPreviewsUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepPreviews() {
    try {
      await this.databaseRunnerService.isolatedRun(async () => {
        await this.sweepPreviewsUseCase.execute();
      });
    } catch (error) {
      this.logger.error('Document preview sweep error:', error.message, error.stack);
    }
  }
}
