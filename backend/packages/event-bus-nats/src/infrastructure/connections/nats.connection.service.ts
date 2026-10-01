import { JetStreamClient, JetStreamManager, jetstream, jetstreamManager } from '@nats-io/jetstream';
import { NatsConnection } from '@nats-io/nats-core';
import { NodeConnectionOptions, connect } from '@nats-io/transport-node';
import { Logger, OnApplicationShutdown } from '@nestjs/common';

/**
 * Owns the single shared NATS connection, the way `RedisConnectionService` owns the ioredis
 * one. The publisher, the stream provisioner and every consumer of the process multiplex over
 * it — NATS needs no extra socket per subscription.
 *
 * `connect()` is async, so the connection is established by the static `create()` and handed
 * to the module through an async factory.
 *
 * nats.js v3 dropped `NatsConnection#jetstream()` / `#jetstreamManager()` in favour of the
 * `jetstream(nc)` / `jetstreamManager(nc)` functions from `@nats-io/jetstream`.
 */
export class NatsConnectionService implements OnApplicationShutdown {
  private readonly logger = new Logger(NatsConnectionService.name);
  private readonly jetStream: JetStreamClient;
  private jetStreamManager?: Promise<JetStreamManager>;

  private constructor(private readonly connection: NatsConnection) {
    this.jetStream = jetstream(connection);
  }

  static async create(options: NodeConnectionOptions): Promise<NatsConnectionService> {
    return new NatsConnectionService(await connect(options));
  }

  getConnection(): NatsConnection {
    return this.connection;
  }

  getJetStream(): JetStreamClient {
    return this.jetStream;
  }

  // Memoized: building the manager round-trips to the server to check the JetStream API, and
  // the server strategy asks for one per subscription it creates.
  getJetStreamManager(): Promise<JetStreamManager> {
    this.jetStreamManager ??= jetstreamManager(this.connection);

    return this.jetStreamManager;
  }

  // Registered last in the module so its hook runs after the consumers are stopped. `drain()`
  // flushes what is already buffered before closing, unlike `close()`.
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.connection.drain();
    } catch (error) {
      this.logger.warn('Failed to close the NATS connection', error);
    }
  }
}
