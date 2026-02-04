import { applyDecorators, Controller, UseFilters, UseInterceptors } from '@nestjs/common';
import { GrpcExceptionFilter } from 'filters';
import { GrpcControllerInterceptor } from 'interceptors';

export const GrpcController = (): ClassDecorator => {
  return applyDecorators(
    Controller(),
    UseInterceptors(GrpcControllerInterceptor),
    UseFilters(GrpcExceptionFilter),
  );
};
