import {
  RedisController,
  RedisEvent,
  RedisFileReadyEventHandler,
  RedisFileTransport,
} from '@backend/event-bus-redis';
import { NestStorage } from '@backend/proto';
import { DocumentMakePreviewUseCase } from '@modules/document/application/use-cases/document.make-preview.use-case';

// One job at a time whatever `REDIS_WORKER_CONCURRENCY` says: each holds a document of up to 50 MB
// in memory, and a render thread. A consumer of its own, so images never queue behind PDFs.
@RedisController({ consumer: 'storage.document', concurrency: 1 })
export class RedisDocumentController implements RedisFileReadyEventHandler {
  constructor(private readonly makePreviewUseCase: DocumentMakePreviewUseCase) {}

  // Every READY file comes through; one that is no PDF is skipped by the use case.
  @RedisEvent(RedisFileTransport.READY)
  async onFileReady(event: NestStorage.File): Promise<void> {
    const result = await this.makePreviewUseCase.execute({ fileId: event.id });

    // Only what a retry can fix is a `left`; the sweep is the backstop once BullMQ gives up.
    if (result.isLeft()) {
      throw result.value;
    }
  }
}
