import { NATS_CLIENT } from '@/infrastructure';
import { Inject } from '@nestjs/common';

export const InjectNatsClient = (): PropertyDecorator & ParameterDecorator => {
  return Inject(NATS_CLIENT);
};
