import {
  RedisController,
  RedisEvent,
  RedisFileReadyEventHandler,
  RedisFileTransport,
} from '@backend/event-bus-redis';
import { NestStorage } from '@backend/proto';
import { ImageMakePreviewUseCase } from '@modules/image/application/use-cases/image.make-preview.use-case';

// One job at a time whatever `REDIS_WORKER_CONCURRENCY` says: each holds an original of up to
// 100 MB in memory.
@RedisController({ consumer: 'storage.image', concurrency: 1 })
export class RedisImageController implements RedisFileReadyEventHandler {
  constructor(private readonly makePreviewUseCase: ImageMakePreviewUseCase) {}

  // Every READY file comes through; one that backs no image is skipped by the use case.
  @RedisEvent(RedisFileTransport.READY)
  async onFileReady(event: NestStorage.File): Promise<void> {
    const result = await this.makePreviewUseCase.execute({ fileId: event.id });

    // Only what a retry can fix is a `left`; the sweep is the backstop once BullMQ gives up.
    if (result.isLeft()) {
      throw result.value;
    }
  }
}
