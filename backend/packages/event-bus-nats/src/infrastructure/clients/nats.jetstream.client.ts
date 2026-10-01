import { JetStreamClient, PubAck } from '@nats-io/jetstream';
import { NatsConnectionService } from '../connections';

/**
 * Producer side of the adapter, the counterpart of `RedisQueueClient`. The generated
 * `Nats<Service>EventBusClientImpl` classes emit through it.
 *
 * Replaces `NatsJetStreamClientProxy` from the dropped wrapper library: the emit API is now
 * promise-based like the Redis one instead of RxJS-based.
 */
export class NatsJetStreamClient {
  private readonly jetStream: JetStreamClient;

  constructor(connectionService: NatsConnectionService) {
    this.jetStream = connectionService.getJetStream();
  }

  // nats.js v3 removed `JSONCodec`. A `Payload` may be a string, which the client encodes as
  // UTF-8 itself, so the bytes on the wire are the same the codec used to produce.
  emit<Event>(subject: string, event: Event): Promise<PubAck> {
    return this.jetStream.publish(subject, JSON.stringify(event));
  }

  emitMany<Event>(subject: string, events: Event[]): Promise<PubAck[]> {
    if (!events.length) {
      return Promise.resolve([]);
    }

    // Sequential on purpose: JetStream assigns stream sequences in publish order, so this is
    // what keeps a batch ordered for the consumers.
    return events.reduce(async (acc: Promise<PubAck[]>, event: Event): Promise<PubAck[]> => {
      const acks = await acc;
      acks.push(await this.emit(subject, event));

      return acks;
    }, Promise.resolve([]));
  }
}
