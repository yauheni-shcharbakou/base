import { applyDecorators, Controller, UseFilters, UseInterceptors, UsePipes } from '@nestjs/common';
import { GrpcExceptionFilter } from 'filters';
import { GrpcControllerInterceptor } from 'interceptors';
import { GrpcTransformDataPipe } from 'pipes';

export const GrpcController = (): ClassDecorator => {
  return applyDecorators(
    Controller(),
    // UsePipes(GrpcTransformDataPipe),
    // UseInterceptors(GrpcControllerInterceptor),
    UseFilters(GrpcExceptionFilter),
  );
};
