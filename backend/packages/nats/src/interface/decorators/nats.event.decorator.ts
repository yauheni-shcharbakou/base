import { EventPattern } from '@nestjs/microservices';

type NatsEventParams = {
  pattern: string;
  registerStream?: () => void;
};

export const NatsEvent = (params: NatsEventParams): MethodDecorator => {
  params.registerStream?.();
  return EventPattern(params.pattern);
};
