import { DatabaseRunnerService } from '@backend/common';
import { VideoHandleProviderStatusUseCase } from '@modules/video/application/use-cases/video.handle-provider-status.use-case';
import { Body, Controller, HttpCode, HttpStatus, Logger, Post, UseGuards } from '@nestjs/common';
import { BunnyStreamSignatureGuard } from './guards/bunny-stream-signature.guard';

type BunnyStreamWebhookBody = {
  VideoLibraryId: number;
  VideoGuid: string;
  Status: number;
};

/**
 * The only HTTP route this service exposes. Video bytes go browser -> Bunny directly, so this
 * callback is the sole signal that an upload finished or failed.
 */
@Controller('webhooks/bunny')
export class HttpBunnyStreamWebhookController {
  private readonly logger = new Logger(HttpBunnyStreamWebhookController.name);

  constructor(
    private readonly handleProviderStatusUseCase: VideoHandleProviderStatusUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  @Post('stream')
  @UseGuards(BunnyStreamSignatureGuard)
  @HttpCode(HttpStatus.OK)
  async onStatusChange(@Body() body: BunnyStreamWebhookBody): Promise<void> {
    try {
      // `PgRequestInterceptor` only wraps rpc contexts, so an HTTP handler opens its own
      // MikroORM context the same way the cron schedulers do.
      await this.databaseRunnerService.isolatedRun(async () => {
        const result = await this.handleProviderStatusUseCase.execute(body.VideoGuid, body.Status);

        if (result.isLeft()) {
          throw result.value;
        }
      });
    } catch (error) {
      // Answer 200 regardless: Bunny would retry a status we already failed to record, and a row
      // that never leaves PENDING is what the cleanup cron exists for.
      this.logger.error(
        `Bunny Stream webhook failed for video ${body.VideoGuid}:`,
        error.message,
        error.stack,
      );
    }
  }
}
