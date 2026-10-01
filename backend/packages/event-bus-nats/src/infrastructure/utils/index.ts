import { NatsConsumerRegistry } from './nats.consumer-registry';
import { NatsStreamRegistry } from './nats.stream-registry';

export * from './nats.consumer-registry';
export * from './nats.stream-registry';

export const globalStreamRegistry = new NatsStreamRegistry();
export const globalConsumerRegistry = new NatsConsumerRegistry();
