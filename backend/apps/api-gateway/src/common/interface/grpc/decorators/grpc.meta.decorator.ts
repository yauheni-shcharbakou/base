import { Metadata } from '@grpc/grpc-js';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GrpcMeta = createParamDecorator((data: unknown, ctx: ExecutionContext): Metadata => {
  const rpcContext = ctx.switchToRpc();
  return rpcContext.getContext();
});
