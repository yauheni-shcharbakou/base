import { resolveErrorMessage } from '@backend/common';
import { ConsumerConfig, ConsumerMessages, JsMsg } from '@nats-io/jetstream';
import { Logger } from '@nestjs/common';
import { CustomTransportStrategy, Server } from '@nestjs/microservices';
import { isObservable, lastValueFrom } from 'rxjs';
import {
  isConsumerPattern,
  NATS_ERROR_FALLBACK,
  NatsConnectionService,
  NatsConsumerRegistry,
  NatsConsumerSubscription,
  NatsStreamData,
  NatsStreamProvisionerService,
} from '@/infrastructure';
import { NatsMessageContext } from '../contexts';

export type NatsEventBusServerParams = {
  connectionService: NatsConnectionService;
  registry: NatsConsumerRegistry;
  provisioner: NatsStreamProvisionerService;
  streams: NatsStreamData[];
  getConsumerConfig: (subscription: NatsConsumerSubscription) => Partial<ConsumerConfig>;
};

/**
 * Consumer side of the adapter: a NestJS custom transport strategy that creates one durable
 * JetStream consumer per `<subject>@<consumerId>` pattern registered by `@NatsController()`.
 *
 * That per-consumer durable is what the Redis mediator emulates with a fan-out worker and a
 * subscription registry — here JetStream delivers a copy to every durable by itself, so
 * neither is needed.
 *
 * Bound in `main.ts` the same way Redis is:
 * `app.connectMicroservice(app.get(NATS_MICROSERVICE_OPTIONS))`.
 */
export class NatsEventBusServer extends Server implements CustomTransportStrategy {
  protected readonly logger = new Logger(NatsEventBusServer.name);
  private readonly consumers: ConsumerMessages[] = [];

  constructor(private readonly params: NatsEventBusServerParams) {
    super();
  }

  async listen(callback: (error?: unknown, ...args: unknown[]) => void): Promise<void> {
    try {
      const subscriptions = this.params.registry.getSubscriptions();

      this.assertSubscriptions(subscriptions);

      // The subscribed streams may be owned by a host that has not started yet, so this
      // process declares them too. `ensure()` is idempotent.
      await this.params.provisioner.ensure(this.params.streams);

      for (const subscription of subscriptions) {
        this.consumers.push(await this.createConsumer(subscription));
      }

      if (subscriptions.length) {
        this.logger.log(`Subscribed as: ${subscriptions.map((item) => item.durable).join(', ')}`);
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  async close(): Promise<void> {
    await Promise.all(
      this.consumers.map(async (consumer) => {
        try {
          await consumer.close();
        } catch (error) {
          this.logger.warn('Failed to stop a NATS consumer', error);
        }
      }),
    );

    this.consumers.length = 0;
  }

  on<EventKey extends string = string, EventCallback = (...args: any[]) => void>(
    _event: EventKey,
    _callback: EventCallback,
  ): void {
    // The JetStream consumer exposes status through an async iterator rather than an event
    // emitter, so there is nothing to forward here — unlike the BullMQ workers in the Redis
    // strategy. Kept to satisfy `CustomTransportStrategy`.
  }

  unwrap<T = ConsumerMessages[]>(): T {
    return this.consumers as T;
  }

  /**
   * Every event handler must resolve to a registered subscription. A pattern without the
   * consumer suffix means the controller never went through `@NatsController()`, and a
   * subscription without a handler means the registry and the controllers drifted apart —
   * both are bootstrap-time mistakes, so fail loudly instead of silently idling a consumer.
   */
  private assertSubscriptions(subscriptions: NatsConsumerSubscription[]): void {
    for (const [pattern, handler] of Array.from(this.messageHandlers.entries())) {
      if (!handler.isEventHandler || isConsumerPattern(pattern)) {
        continue;
      }

      throw new Error(
        `NATS event pattern "${pattern}" is not bound to a consumer. Add @NatsController({ consumer: '<host>.<module>' }) above the transport decorator of the controller that handles it.`,
      );
    }

    for (const subscription of subscriptions) {
      if (this.getHandlerByPattern(subscription.pattern)) {
        continue;
      }

      throw new Error(
        `No handler registered for the NATS consumer "${subscription.durable}". Is the controller declared in a module?`,
      );
    }
  }

  private async createConsumer(subscription: NatsConsumerSubscription): Promise<ConsumerMessages> {
    const streamName = this.findStreamName(subscription.subject);
    const manager = await this.params.connectionService.getJetStreamManager();
    const config = this.params.getConsumerConfig(subscription);

    try {
      await manager.consumers.info(streamName, subscription.durable);
    } catch {
      await manager.consumers.add(streamName, config);
    }

    const consumer = await this.params.connectionService
      .getJetStream()
      .consumers.get(streamName, subscription.durable);

    return consumer.consume({
      callback: (message: JsMsg) => {
        void this.handleMessage(subscription, message);
      },
    });
  }

  private findStreamName(subject: string): string {
    const stream = this.params.streams.find((item) => item.subjects.includes(subject));

    if (!stream) {
      throw new Error(
        `No JetStream stream registered for the subject "${subject}". Is the transport decorator applied to the controller that handles it?`,
      );
    }

    return stream.name;
  }

  private async handleMessage(
    subscription: NatsConsumerSubscription,
    message: JsMsg,
  ): Promise<void> {
    const handler = this.getHandlerByPattern(subscription.pattern);

    if (!handler) {
      // Cannot happen after `assertSubscriptions`, but a message must never stay in limbo:
      // nak it so it is redelivered instead of blocking the consumer until `ack_wait`.
      message.nak();
      return;
    }

    const context = new NatsMessageContext([message, subscription]);

    try {
      // `msg.json()` is what replaced `JSONCodec().decode()` in nats.js v3. It throws on a
      // malformed payload just the same, and the catch below turns that into a nak.
      const result = await handler(message.json(), context);

      // With interceptors in play the handler resolves to an observable — it has to be
      // subscribed to, otherwise the controller logic never runs and nothing acks.
      if (isObservable(result)) {
        await lastValueFrom(result, { defaultValue: undefined });
      }
    } catch (error) {
      // The interceptor already logged the real error and naked the message. What arrives here is
      // the same failure after Nest's `RpcExceptionsHandler` flattened it to a bare "Internal
      // server error", so repeating it would add a log line that says strictly less than the one
      // above it — and a second nak on top of an answered message.
      if (context.isAnswered()) {
        return;
      }

      // This guards the rest: a handler that threw before the pipe was built, or a decode failure.
      // Same reason as in the interceptor for resolving the message — a wrapper error carries none
      // of its own, and with no DLQ to inspect the log line is all that is left of the failure.
      this.logger.error(
        `Consumer "${subscription.durable}" failed on delivery ${message.info.deliveryCount}: ${resolveErrorMessage(error, NATS_ERROR_FALLBACK)}`,
      );
      message.nak();
    }
  }
}
