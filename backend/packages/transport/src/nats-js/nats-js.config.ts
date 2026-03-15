import {
  NatsJetStreamClientOptions,
  NatsJetStreamServerOptions,
  NatsStreamConfig,
} from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { validateEnv } from '@packages/common';
import { kebabCase } from 'change-case-all';
import zod from 'zod';

const env = validateEnv({
  NATS_URL: zod.string().default('nats://localhost:4222'),
});

export const natsJsConfig = () => {
  const natsUrl = env.NATS_URL;

  return {
    getServerOptions: (
      host: string,
      streams: NatsStreamConfig[] = [],
    ): NatsJetStreamServerOptions => {
      const serverName = kebabCase(host);

      return {
        connectionOptions: {
          servers: [natsUrl],
          name: `${serverName}-nats-server`,
        },
        consumerOptions: {
          durable: `${serverName}-nats-durable`,
          deliverGroup: `${serverName}-nats-group`,
          deliverPolicy: 'All',
          deliverTo: `${serverName}-nats-messages`,
          manualAck: true,
          ackWait: 30000,
          maxDeliver: 10,
          maxAckPending: 1,
        },
        streamConfig: streams,
      };
    },
    getClientOptions: (host: string): NatsJetStreamClientOptions => {
      const clientName = kebabCase(host);

      return {
        connectionOptions: {
          servers: [natsUrl],
          name: `${clientName}-nats-client`,
        },
      };
    },
  } as const;
};

export type NatsJsConfig = ReturnType<typeof natsJsConfig>;
