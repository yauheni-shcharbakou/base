import { applyDecorators, Controller, UseFilters } from '@nestjs/common';
import { GrpcExceptionFilter } from 'grpc/filters';

export const GrpcController = (): ClassDecorator => {
  return applyDecorators(Controller(), UseFilters(GrpcExceptionFilter));
};
