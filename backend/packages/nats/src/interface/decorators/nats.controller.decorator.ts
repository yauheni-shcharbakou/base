import { applyDecorators, Controller, UseInterceptors } from '@nestjs/common';
import { NatsControllerInterceptor } from '../interceptors';

export const NatsController = (): ClassDecorator => {
  return applyDecorators(Controller(), UseInterceptors(NatsControllerInterceptor));
};
