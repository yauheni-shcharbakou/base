import { EventPattern } from '@nestjs/microservices';
import { NatsStreamData } from 'nats-js/nats-js.types';
import { globalStreamRegistry } from 'nats-js/utils';

type NatsJsEventParams = {
  pattern: string;
  stream: NatsStreamData;
};

export const NatsJsEvent = (params: NatsJsEventParams): MethodDecorator => {
  globalStreamRegistry.append(params.stream);
  return EventPattern(params.pattern);
};
