import { DatabaseRunnerService } from '@backend/common';
import { DocumentSweepPreviewsUseCase } from '@modules/document/application/use-cases/document.sweep-previews.use-case';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronDocumentScheduler {
  private readonly logger = new Logger(CronDocumentScheduler.name);
  private isSweeping = false;

  constructor(
    private readonly sweepPreviewsUseCase: DocumentSweepPreviewsUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepPreviews() {
    // The sweep's size is set by env, so one can outlast the tick. A second one would read the
    // same rows and render them beside the first — two documents at once. Per process only.
    if (this.isSweeping) {
      this.logger.warn('Document preview sweep skipped: the previous one is still running');
      return;
    }

    this.isSweeping = true;

    try {
      await this.databaseRunnerService.isolatedRun(async () => {
        await this.sweepPreviewsUseCase.execute();
      });
    } catch (error) {
      this.logger.error('Document preview sweep error:', error.message, error.stack);
    } finally {
      this.isSweeping = false;
    }
  }
}
