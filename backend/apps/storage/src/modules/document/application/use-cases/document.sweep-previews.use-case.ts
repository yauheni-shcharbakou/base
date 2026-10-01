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
 */
@Injectable()
export class DocumentSweepPreviewsUseCase {
  private readonly logger = new Logger(DocumentSweepPreviewsUseCase.name);
  /** Documents one sweep takes on — `STORAGE_DOCUMENT_PREVIEW_SWEEP_LIMIT`. */
  private readonly limit: number;
  /**
   * A document READY for this long without a preview was missed by the READY event — the emit is
   * logged, never retried — so the sweep does not race a handler that is still at work.
   */
  private readonly graceMinutes: number;

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly makePreviewUseCase: DocumentMakePreviewUseCase,
    configService: ConfigService<Config>,
  ) {
    const sweep = configService.getOrThrow('documentPreviewSweep', { infer: true });

    this.limit = sweep.limit;
    this.graceMinutes = sweep.graceMinutes;
  }

  async execute(): Promise<void> {
    const files = await this.fileRepository.getManyWithoutPreview(
      PREVIEWABLE_DOCUMENT_TYPES,
      moment().subtract(this.graceMinutes, 'minutes').toDate(),
      this.limit,
    );

    for (const file of files) {
      const result = await this.makePreviewUseCase.execute({ fileId: file.id });

      if (result.isLeft()) {
        this.logger.warn(`File ${file.id}: no preview this sweep: ${result.value.message}`);
      }
    }
  }
}
