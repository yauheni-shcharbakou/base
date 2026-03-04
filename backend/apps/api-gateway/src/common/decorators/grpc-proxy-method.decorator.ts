import { GrpcProxyStreamMethodParams } from '@backend/grpc';
import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { GrpcStreamMethodInterceptor } from 'common/interceptors/grpc.stream-method.interceptor';

export const GrpcProxyStreamMethod = (params?: GrpcProxyStreamMethodParams) => {
  return applyDecorators(
    ...(params?.decorators ?? []),
    UseInterceptors(GrpcStreamMethodInterceptor),
  );
};
