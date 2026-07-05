import { GrpcParsedMeta } from '@backend/grpc';
import { status } from '@grpc/grpc-js';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

interface Options {
  required?: boolean;
}

export const GrpcUserId = createParamDecorator(
  (options: Options = { required: true }, ctx: ExecutionContext): string | undefined => {
    const rpcContext = ctx.switchToRpc();
    const rawMetadata = rpcContext.getContext();

    if (!rawMetadata || typeof rawMetadata.get !== 'function') {
      if (options.required) {
        throw new RpcException({
          code: status.INVALID_ARGUMENT,
          message: 'Grpc metadata is missing',
        });
      }

      return undefined;
    }

    const parsedMetadata = new GrpcParsedMeta(rawMetadata);
    return parsedMetadata[options.required ? 'getOrThrow' : 'get']('user-id');
  },
);
