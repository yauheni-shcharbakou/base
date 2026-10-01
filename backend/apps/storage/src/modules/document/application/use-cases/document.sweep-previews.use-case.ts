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

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly makePreviewUseCase: DocumentMakePreviewUseCase,
    configService: ConfigService<Config>,
  ) {
    const sweep = configService.getOrThrow('documentPreviewSweep', { infer: true });

    this.limit = sweep.limit;
    this.graceMinutes = sweep.graceMinutes;
    this.maxAttempts = sweep.maxAttempts;
  }

  /**
   * Answers the id to go on from, or nothing once the backlog ended in this batch. The next batch
   * starts past it whatever became of these documents, so one that keeps failing holds nothing
   * back — the next sweep starts over and comes to it again.
   */
  async execute(afterId?: string): Promise<string | undefined> {
    const files = await this.fileRepository.getManyWithoutPreview(
      PREVIEWABLE_DOCUMENT_TYPES,
      moment().subtract(this.graceMinutes, 'minutes').toDate(),
      this.limit,
      afterId,
    );

    for (const file of files) {
      const result = await this.makePreviewUseCase.execute({ fileId: file.id });

      if (result.isLeft()) {
        this.logger.warn(`File ${file.id}: no preview this sweep: ${result.value.message}`);
        await this.countAttempt(file.id);
      }
    }

    return files.length === this.limit ? files[files.length - 1].id : undefined;
  }

  // A `left` is a failure a retry might fix, but the sweep cannot tell one that never will — a
  // document whose stream breaks every time — and would download it again every sweep, for good.
  // Counted here and not in the use case it calls: the event handler's retries are BullMQ's.
  private async countAttempt(id: string): Promise<void> {
    if (!this.maxAttempts) {
      return;
    }

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
