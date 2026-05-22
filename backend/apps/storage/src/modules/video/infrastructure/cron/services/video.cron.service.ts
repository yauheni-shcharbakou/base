import { DatabaseRunnerService } from '@backend/common';
import { VideoSyncWithProviderUseCase } from '@modules/video/application/use-cases/video.sync-with-provider.use-case';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class VideoCronService {
  private readonly logger = new Logger(VideoCronService.name);

  constructor(
    private readonly syncWithProviderUseCase: VideoSyncWithProviderUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupFiles() {
    try {
      await this.databaseRunnerService.isolatedRun(async () => {
        await this.syncWithProviderUseCase.execute();
      });
    } catch (error) {
      this.logger.error('Video sync error:', error.message, error.stack);
    }
  }
}
