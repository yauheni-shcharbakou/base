import { applyDecorators, Controller, UseInterceptors } from '@nestjs/common';
import { NatsJsControllerInterceptor } from 'nats-js/interceptors';

export const NatsJsController = (): ClassDecorator => {
  return applyDecorators(Controller(), UseInterceptors(NatsJsControllerInterceptor));
};
