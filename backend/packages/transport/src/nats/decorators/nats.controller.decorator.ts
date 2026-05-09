import { applyDecorators, Controller, UseInterceptors } from '@nestjs/common';
import { NatsControllerInterceptor } from 'nats_/interceptors';

export const NatsController = (): ClassDecorator => {
  return applyDecorators(Controller(), UseInterceptors(NatsControllerInterceptor));
};
