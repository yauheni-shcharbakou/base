import { Logger } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import moment from 'moment';

/** What a sweep's use case reads of its `*PreviewSweep` config — the budget is the scheduler's. */
export interface PreviewSweepSettings {
  /** Rows one batch takes on. */
  limit: number;
  /**
   * A row READY for this long without a preview was missed by the READY event — the emit is
   * logged, never retried — so the sweep does not race a handler that is still at work.
   */
  graceMinutes: number;
  /** Sweeps a row may fail before it is given up on; 0 never gives up. */
  maxAttempts: number;
  /**
   * Rows in a row a batch may fail before the sweep stops and counts none of them: that many at
   * once is the provider down, not the rows. 0 never stops.
   */
  breakerThreshold: number;
}

/**
 * Makes the previews the READY event did not: a lost emit, a handler that ran out of retries, and
 * every original uploaded before previews existed. Sequential, so at most one original is in
 * memory. The image and the document sweeps are this one, each over its own rows.
 *
 * One call is one batch. The scheduler calls again with the id this one answered, for as long as
 * its budget lasts (ADR-0037).
 */
export abstract class PreviewSweepUseCase<Row extends { id: string }> {
  protected readonly logger = new Logger(this.constructor.name);

  protected constructor(
    /** What a row is in the log: `Image`, `Document`. */
    private readonly subject: string,
    private readonly settings: PreviewSweepSettings,
  ) {
    // A run is within a batch, and a batch is never that long.
    if (settings.breakerThreshold > settings.limit) {
      this.logger.warn(
        `The breaker never stops a sweep: its threshold of ${settings.breakerThreshold} is over the batch limit of ${settings.limit}`,
      );
    }
  }

  /**
   * The rows READY since before `readyBefore` with neither a preview nor a failure recorded,
   * oldest first, past `afterId` when one is given.
   */
  protected abstract getRows(readyBefore: Date, limit: number, afterId?: string): Promise<Row[]>;

  /** `left` for what a retry can fix; `right(true)` only when the provider answered on the way. */
  protected abstract makePreview(row: Row): Promise<Either<Error, boolean>>;

  /** Counts a sweep that came back from the row without a preview; `true` when it gave up on it. */
  protected abstract countPreviewAttempt(
    id: string,
    maxAttempts: number,
  ): Promise<Either<Error, boolean>>;

  /**
   * Answers the id to go on from, or nothing once the backlog ended in this batch. The next batch
   * starts past it whatever became of these rows, so one that keeps failing holds nothing back —
   * the next sweep starts over and comes to it again.
   *
   * Answers nothing as well once the breaker stops the sweep: the rows that failed in a row are
   * not counted, and the next sweep starts with them again.
   */
  async execute(afterId?: string): Promise<string | undefined> {
    const { limit, graceMinutes, breakerThreshold } = this.settings;

    const rows = await this.getRows(
      moment().subtract(graceMinutes, 'minutes').toDate(),
      limit,
      afterId,
    );

    // Failed in a row up to here, and not counted yet: the breaker may still drop them.
    const failedInARow: string[] = [];

    for (const row of rows) {
      const result = await this.makePreview(row);

      if (result.isLeft()) {
        this.logger.warn(
          `${this.subject} ${row.id}: no preview this sweep: ${result.value.message}`,
        );
        failedInARow.push(row.id);

        if (failedInARow.length === breakerThreshold) {
          this.logger.warn(
            `${this.subject} preview sweep stopped: ${failedInARow.length} in a row got no preview, none of them counted`,
          );
          return undefined;
        }

        continue;
      }

      // The provider answered, so those before this one failed by themselves. One that never
      // asked it proves nothing, and leaves the run as it is.
      if (result.value) {
        await this.countAttempts(failedInARow.splice(0));
      }
    }

    await this.countAttempts(failedInARow);

    return rows.length === limit ? rows[rows.length - 1].id : undefined;
  }

  // A `left` is a failure a retry might fix, but the sweep cannot tell one that never will — an
  // original whose stream breaks every time — and would download it again every sweep, for good.
  // Counted here and not in the use case it calls: the event handler's retries are BullMQ's.
  private async countAttempts(ids: string[]): Promise<void> {
    if (!this.settings.maxAttempts) {
      return;
    }

    for (const id of ids) {
      await this.countAttempt(id);
    }
  }

  private async countAttempt(id: string): Promise<void> {
    const { maxAttempts } = this.settings;
    const gaveUp = await this.countPreviewAttempt(id, maxAttempts);

    if (gaveUp.isLeft()) {
      this.logger.error(`${this.subject} ${id}: failed to count the attempt`, gaveUp.value);
      return;
    }

    if (gaveUp.value) {
      this.logger.warn(
        `${this.subject} ${id}: given up on after ${maxAttempts} sweeps without a preview`,
      );
    }
  }
}
