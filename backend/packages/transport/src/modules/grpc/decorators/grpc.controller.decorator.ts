import { applyDecorators, Controller, UseFilters, UseInterceptors, UsePipes } from '@nestjs/common';
import { GrpcExceptionFilter } from 'modules/grpc/filters';
import { GrpcControllerInterceptor } from 'modules/grpc/interceptors';
import { GrpcTransformDataPipe } from 'modules/grpc/pipes';

export const GrpcController = (): ClassDecorator => {
  return applyDecorators(
    Controller(),
    UsePipes(GrpcTransformDataPipe),
    UseInterceptors(GrpcControllerInterceptor),
    UseFilters(GrpcExceptionFilter),
  );
};
