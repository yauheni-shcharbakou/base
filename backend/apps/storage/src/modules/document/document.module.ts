import { FileModule } from '@modules/file/file.module';
import { StorageModule } from '@modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { DocumentMakePreviewUseCase } from './application/use-cases/document.make-preview.use-case';
import { DocumentSweepPreviewsUseCase } from './application/use-cases/document.sweep-previews.use-case';
import { DocumentPreviewService } from './domain/services/document.preview.service';
import { PdfjsDocumentPreviewServiceImpl } from './infrastructure/services/pdfjs.document.preview.service.impl';
import { CronDocumentScheduler } from './interface/cron/cron.document.scheduler';
import { RedisDocumentController } from './interface/redis/redis.document.controller';

/**
 * Previews of plain files — the first page of a PDF — made after upload (ADR-0032). It owns no table:
 * the preview lives on the file row, written through the file module's repository.
 */
@Module({
  imports: [StorageModule, FileModule],
  providers: [
    {
      provide: DocumentPreviewService,
      useClass: PdfjsDocumentPreviewServiceImpl,
    },
    DocumentMakePreviewUseCase,
    DocumentSweepPreviewsUseCase,
    CronDocumentScheduler,
  ],
  controllers: [RedisDocumentController],
})
export class DocumentModule {}
