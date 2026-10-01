import { RedisQueueRegistry } from './redis.queue-registry';

export * from './redis.queue-registry';
export * from './redis.timeout';

export const globalQueueRegistry = new RedisQueueRegistry();
