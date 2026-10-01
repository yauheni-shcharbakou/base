import { Config } from '@/config';
import {
  DocumentMakePreviewUseCase,
  PREVIEWABLE_DOCUMENT_TYPES,
} from '@modules/document/application/use-cases/document.make-preview.use-case';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import moment from 'moment';

/**
 * Makes the previews the READY event did not: a lost emit, a handler that ran out of retries, and
 * every PDF uploaded before previews existed. Sequential, so at most one document is in memory.
 *
 * One call is one batch. The scheduler calls again with the id this one answered, for as long as
 * its budget lasts (ADR-0037).
 */
@Injectable()
export class DocumentSweepPreviewsUseCase {
  private readonly logger = new Logger(DocumentSweepPreviewsUseCase.name);
  /** Documents one batch takes on — `STORAGE_DOCUMENT_PREVIEW_SWEEP_LIMIT`. */
  private readonly limit: number;
  /**
   * A document READY for this long without a preview was missed by the READY event — the emit is
   * logged, never retried — so the sweep does not race a handler that is still at work.
   */
  private readonly graceMinutes: number;
  /** Sweeps a document may fail before it is given up on; 0 never gives up. */
  private readonly maxAttempts: number;
  /**
   * Documents in a row a batch may fail before the sweep stops and counts none of them: that many
   * at once is the provider down, not the documents. 0 never stops.
   */
  private readonly breakerThreshold: number;

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly makePreviewUseCase: DocumentMakePreviewUseCase,
    configService: ConfigService<Config>,
  ) {
    const sweep = configService.getOrThrow('documentPreviewSweep', { infer: true });

    this.limit = sweep.limit;
    this.graceMinutes = sweep.graceMinutes;
    this.maxAttempts = sweep.maxAttempts;
    this.breakerThreshold = sweep.breakerThreshold;

    // A run is within a batch, and a batch is never that long.
    if (this.breakerThreshold > this.limit) {
      this.logger.warn(
        `The breaker never stops a sweep: its threshold of ${this.breakerThreshold} is over the batch limit of ${this.limit}`,
      );
    }
  }

  /**
   * Answers the id to go on from, or nothing once the backlog ended in this batch. The next batch
   * starts past it whatever became of these documents, so one that keeps failing holds nothing
   * back — the next sweep starts over and comes to it again.
   *
   * Answers nothing as well once the breaker stops the sweep: the documents that failed in a row
   * are not counted, and the next sweep starts with them again.
   */
  async execute(afterId?: string): Promise<string | undefined> {
    const files = await this.fileRepository.getManyWithoutPreview(
      PREVIEWABLE_DOCUMENT_TYPES,
      moment().subtract(this.graceMinutes, 'minutes').toDate(),
      this.limit,
      afterId,
    );

    // Failed in a row up to here, and not counted yet: the breaker may still drop them.
    const failedInARow: string[] = [];

    for (const file of files) {
      const result = await this.makePreviewUseCase.execute({ fileId: file.id });

      if (result.isLeft()) {
        this.logger.warn(`File ${file.id}: no preview this sweep: ${result.value.message}`);
        failedInARow.push(file.id);

        if (failedInARow.length === this.breakerThreshold) {
          this.logger.warn(
            `Document preview sweep stopped: ${failedInARow.length} documents in a row got no preview, none of them counted`,
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

    return files.length === this.limit ? files[files.length - 1].id : undefined;
  }

  // A `left` is a failure a retry might fix, but the sweep cannot tell one that never will — a
  // document whose stream breaks every time — and would download it again every sweep, for good.
  // Counted here and not in the use case it calls: the event handler's retries are BullMQ's.
  private async countAttempts(ids: string[]): Promise<void> {
    if (!this.maxAttempts) {
      return;
    }

    for (const id of ids) {
      await this.countAttempt(id);
    }
  }

  private async countAttempt(id: string): Promise<void> {
    const gaveUp = await this.fileRepository.countPreviewAttempt(id, this.maxAttempts);

    if (gaveUp.isLeft()) {
      this.logger.error(`File ${id}: failed to count the attempt`, gaveUp.value);
      return;
    }

    if (gaveUp.value) {
      this.logger.warn(
        `File ${id}: given up on after ${this.maxAttempts} sweeps without a preview`,
      );
    }
  }
}
