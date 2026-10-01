import { DatabaseRunnerService } from '@backend/common';
import { Config } from '@/config';
import { ImageSweepPreviewsUseCase } from '@modules/image/application/use-cases/image.sweep-previews.use-case';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronImageScheduler {
  private readonly logger = new Logger(CronImageScheduler.name);
  private readonly budgetMinutes: number;
  private isSweeping = false;

  constructor(
    private readonly sweepPreviewsUseCase: ImageSweepPreviewsUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
    configService: ConfigService<Config>,
  ) {
    this.budgetMinutes = configService.getOrThrow('imagePreviewSweep', {
      infer: true,
    }).budgetMinutes;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepPreviews() {
    // A sweep can outlast the tick — its budget is env's, and the batch at work when it runs out
    // is finished. A second one would read the same rows and render them beside the first — two
    // originals at once. Per process only.
    if (this.isSweeping) {
      this.logger.warn('Image preview sweep skipped: the previous one is still running');
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
      this.logger.error('Image preview sweep error:', error.message, error.stack);
    } finally {
      this.isSweeping = false;
    }
  }
}
