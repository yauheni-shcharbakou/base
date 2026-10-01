import { DatabaseRunnerService } from '@backend/common';
import { Config } from '@/config';
import { PreviewSweepScheduler } from '@common/interface/cron/preview.sweep.scheduler';
import { ImageSweepPreviewsUseCase } from '@modules/image/application/use-cases/image.sweep-previews.use-case';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronImageScheduler extends PreviewSweepScheduler {
  constructor(
    sweepPreviewsUseCase: ImageSweepPreviewsUseCase,
    databaseRunnerService: DatabaseRunnerService,
    configService: ConfigService<Config>,
  ) {
    super(
      'Image',
      configService.getOrThrow('imagePreviewSweep', { infer: true }).budgetMinutes,
      sweepPreviewsUseCase,
      databaseRunnerService,
    );
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  sweepPreviews() {
    return this.sweep();
  }
}
