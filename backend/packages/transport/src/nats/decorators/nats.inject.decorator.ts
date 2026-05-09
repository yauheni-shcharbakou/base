import { Inject } from '@nestjs/common';
import { NATS_CLIENT } from 'nats_/nats.constants';

export const InjectNatsClient = (): PropertyDecorator & ParameterDecorator => {
  return Inject(NATS_CLIENT);
};
