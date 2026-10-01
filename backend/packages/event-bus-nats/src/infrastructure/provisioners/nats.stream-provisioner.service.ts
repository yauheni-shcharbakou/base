import { StreamConfig } from '@nats-io/jetstream';
import { WithRequired } from '@nats-io/nats-core';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { NatsConnectionService } from '../connections';
import { NatsStreamData } from '../types';

export type NatsStreamProvisionerParams = {
  /** Streams of the events this host owns — declared even when the host only emits. */
  streams: NatsStreamData[];
  connectionService: NatsConnectionService;
  getStreamConfig: (stream: NatsStreamData) => WithRequired<Partial<StreamConfig>, 'name'>;
};

/**
 * Declares the JetStream streams a host owns. It occupies the slot `RedisMediatorService`
 * holds in the Redis module — the host-owned piece that runs even in `onlyEmitting` mode —
 * but the job is different: JetStream fans an event out to every durable consumer on its
 * own, so nothing has to be re-published here.
 *
 * Declaring owned streams at `forRoot` closes a gap the old wiring had: streams used to be
 * declared only by the process where a subscriber controller happened to be loaded, so a
 * pure producer published into a stream that did not exist yet.
 */
export class NatsStreamProvisionerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NatsStreamProvisionerService.name);

  constructor(private readonly params: NatsStreamProvisionerParams) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensure(this.params.streams);
  }

  /**
   * Idempotent: the server strategy calls it again for the streams this process subscribes
   * to, which may be owned by another host that has not started yet.
   */
  async ensure(streams: NatsStreamData[]): Promise<void> {
    if (!streams.length) {
      return;
    }

    const manager = await this.params.connectionService.getJetStreamManager();

    for (const stream of streams) {
      const config = this.params.getStreamConfig(stream);

      try {
        await manager.streams.info(stream.name);
        // Only the subject list may legitimately change between deploys; the rest of the
        // config stays as it was created, so an operator's manual tuning is not reverted.
        await manager.streams.update(stream.name, { subjects: stream.subjects });
      } catch {
        await manager.streams.add(config);
      }
    }

    this.logger.log(`Declared streams: ${streams.map((stream) => stream.name).join(', ')}`);
  }
}
