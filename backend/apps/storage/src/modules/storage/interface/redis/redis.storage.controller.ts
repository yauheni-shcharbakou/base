import { FilePurgeEvent } from '@backend/event-bus';
import {
  RedisController,
  RedisEvent,
  RedisFilePurgeEventHandler,
  RedisFileTransport,
} from '@backend/event-bus-redis';
import { StoragePurgeUseCase } from '@modules/storage/application/use-cases/storage.purge.use-case';

@RedisController({ consumer: 'storage.storage' })
export class RedisStorageController implements RedisFilePurgeEventHandler {
  constructor(private readonly purgeUseCase: StoragePurgeUseCase) {}

  @RedisEvent(RedisFileTransport.PURGE)
  async onFilePurge(event: FilePurgeEvent): Promise<void> {
    const result = await this.purgeUseCase.execute(event);

    // Throwing fails the job, so BullMQ retries it; the rows are already gone, and this job is the
    // only thing left that knows the object exists.
    if (result.isLeft()) {
      throw result.value;
    }
  }
}
