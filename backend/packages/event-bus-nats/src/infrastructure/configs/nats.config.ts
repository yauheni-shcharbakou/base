import {
  AckPolicy,
  ConsumerConfig,
  DeliverPolicy,
  RetentionPolicy,
  StorageType,
  StreamConfig,
} from '@nats-io/jetstream';
import { WithRequired, nanos } from '@nats-io/nats-core';
import { registerAs } from '@nestjs/config';
import { NodeConnectionOptions } from '@nats-io/transport-node';
import { validateEnv } from '@packages/common';
import { kebabCase } from 'change-case-all';
import zod from 'zod';
import { NatsConsumerSubscription, NatsStreamData } from '../types';

const env = validateEnv({
  NATS_URL: zod.string().default('nats://localhost:4222'),
  NATS_ACK_WAIT_MS: zod.coerce.number().int().positive().default(30000),
  NATS_MAX_DELIVER: zod.coerce.number().int().positive().default(10),
  NATS_CONSUMER_CONCURRENCY: zod.coerce.number().int().positive().default(1),
  // `all` replays the stream from the beginning the first time a durable is created, so a
  // subscriber added later still sees the events it missed. `new` is the Redis-adapter
  // behaviour, where the mediator drops an event nobody was registered for yet.
  NATS_DELIVER_POLICY: zod.enum(['all', 'new']).default('all'),
});

/**
 * Namespaced for the reason `@backend/cache` and `@backend/event-bus-redis` are: a plain factory's
 * keys are merged into one flat store, and `getConnectionOptions` is a name all three picked.
 *
 * @see docs/adr/0012-namespaced-package-config.md
 */
export const natsConfig = registerAs('eventBusNats', () => {
  const natsUrl = env.NATS_URL;

  return {
    // `NodeConnectionOptions`, not the core `ConnectionOptions`: it is what the Node transport's
    // `connect()` takes, and it narrows `tls` to the Node-specific shape.
    getConnectionOptions: (host: string): NodeConnectionOptions => {
      const clientName = kebabCase(host);

      return {
        servers: [natsUrl],
        name: `${clientName}-nats-client`,
      };
    },
    // `name` is required by `jsm.streams.add()`, so it is pinned in the type rather than left
    // optional the way the rest of the partial config is.
    getStreamConfig: (stream: NatsStreamData): WithRequired<Partial<StreamConfig>, 'name'> => {
      return {
        name: stream.name,
        subjects: stream.subjects,
        retention: RetentionPolicy.Limits,
        storage: StorageType.File,
      };
    },
    /**
     * One durable per (subject, consumer). `max_ack_pending` — not the client-side buffer —
     * is what bounds in-flight messages: the server withholds the next one until the current
     * is acked, which is the equivalent of the Redis worker `concurrency`.
     */
    getConsumerConfig: (subscription: NatsConsumerSubscription): Partial<ConsumerConfig> => {
      return {
        durable_name: subscription.durable,
        filter_subject: subscription.subject,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: env.NATS_DELIVER_POLICY === 'new' ? DeliverPolicy.New : DeliverPolicy.All,
        ack_wait: nanos(env.NATS_ACK_WAIT_MS),
        max_deliver: env.NATS_MAX_DELIVER,
        max_ack_pending: subscription.concurrency ?? env.NATS_CONSUMER_CONCURRENCY,
      };
    },
  } as const;
});

export type NatsConfig = ReturnType<typeof natsConfig>;
