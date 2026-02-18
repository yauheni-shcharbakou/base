import { GrpcProxyStreamMethodParams } from '@backend/grpc';
import { applyDecorators } from '@nestjs/common';
import { SkipAuth } from 'common/decorators/access.decorator';

export const GrpcProxyStreamMethod = (params?: GrpcProxyStreamMethodParams) => {
  return applyDecorators(...(params?.decorators ?? []), SkipAuth());
};
