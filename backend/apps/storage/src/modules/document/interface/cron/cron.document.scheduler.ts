import { DatabaseRunnerService } from '@backend/common';
import { Config } from '@/config';
import { DocumentSweepPreviewsUseCase } from '@modules/document/application/use-cases/document.sweep-previews.use-case';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronDocumentScheduler {
  private readonly logger = new Logger(CronDocumentScheduler.name);
  private readonly budgetMinutes: number;
  private isSweeping = false;

  constructor(
    private readonly sweepPreviewsUseCase: DocumentSweepPreviewsUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
    configService: ConfigService<Config>,
  ) {
    this.budgetMinutes = configService.getOrThrow('documentPreviewSweep', {
      infer: true,
    }).budgetMinutes;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepPreviews() {
    // A sweep can outlast the tick — its budget is env's, and the batch at work when it runs out
    // is finished. A second one would read the same rows and render them beside the first — two
    // documents at once. Per process only.
    if (this.isSweeping) {
      this.logger.warn('Document preview sweep skipped: the previous one is still running');
      return;
    }

    this.isSweeping = true;

    try {
      const deadline = Date.now() + this.budgetMinutes * 60_000;
      let cursor: string | undefined;

      // Batch after batch while the backlog and the budget last, the first one whatever the
      // budget. A context per batch: one held for the whole sweep would keep every row it read.
      do {
        cursor = await this.databaseRunnerService.isolatedRun(() =>
          this.sweepPreviewsUseCase.execute(cursor),
        );
      } while (cursor && Date.now() < deadline);
    } catch (error) {
      this.logger.error('Document preview sweep error:', error.message, error.stack);
    } finally {
      this.isSweeping = false;
    }
  }
}
