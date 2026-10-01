import { EventPattern } from '@nestjs/microservices';

type RedisEventParams = {
  pattern: string;
};

/**
 * Subscribes a method to an event owned by another service. The pattern stays the bare
 * event id here — `@RedisController()` rewrites it into `<eventId>@<consumerId>` once the
 * class decorator runs, because that is the first point where the consumer id is known.
 */
export const RedisEvent = (params: RedisEventParams): MethodDecorator => {
  return EventPattern(params.pattern);
};
