import { DatabaseRunnerService } from '@backend/common';
import { Config } from '@/config';
import { PreviewSweepScheduler } from '@common/interface/cron/preview.sweep.scheduler';
import { DocumentSweepPreviewsUseCase } from '@modules/document/application/use-cases/document.sweep-previews.use-case';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronDocumentScheduler extends PreviewSweepScheduler {
  constructor(
    sweepPreviewsUseCase: DocumentSweepPreviewsUseCase,
    databaseRunnerService: DatabaseRunnerService,
    configService: ConfigService<Config>,
  ) {
    super(
      'Document',
      configService.getOrThrow('documentPreviewSweep', { infer: true }).budgetMinutes,
      sweepPreviewsUseCase,
      databaseRunnerService,
    );
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  sweepPreviews() {
    return this.sweep();
  }
}
