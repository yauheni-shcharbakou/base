import { DatabaseRunnerService } from '@backend/common';
import { PreviewSweepUseCase } from '@common/application/use-cases/preview.sweep.use-case';
import { Logger } from '@nestjs/common';

/**
 * How a preview sweep is run: never two at once, batch after batch within a budget, each batch in
 * a context of its own (ADR-0037). The image and the document schedulers are this one; the tick
 * is theirs — each puts its own `@Cron` on a method that calls `sweep`.
 */
export abstract class PreviewSweepScheduler {
  protected readonly logger = new Logger(this.constructor.name);
  private isSweeping = false;

  protected constructor(
    /** What is swept, in the log: `Image`, `Document`. */
    private readonly subject: string,
    /** How long a sweep goes on taking further batches; 0 is one batch a sweep. */
    private readonly budgetMinutes: number,
    private readonly sweepPreviewsUseCase: PreviewSweepUseCase<{ id: string }>,
    private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  protected async sweep(): Promise<void> {
    // A sweep can outlast the tick — its budget is env's, and the batch at work when it runs out
    // is finished. A second one would read the same rows and render them beside the first — two
    // originals at once. Per process only.
    if (this.isSweeping) {
      this.logger.warn(`${this.subject} preview sweep skipped: the previous one is still running`);
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
      this.logger.error(`${this.subject} preview sweep error:`, error.message, error.stack);
    } finally {
      this.isSweeping = false;
    }
  }
}
