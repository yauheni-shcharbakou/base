import { getHttpExceptionResponseMessage } from '@backend/common';
import { status } from '@grpc/grpc-js';
import { HttpException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { GrpcStatusCodeMapper } from 'mappers/grpc.status-code.mapper';

export class GrpcExceptionMapper {
  static toRpcException(exception: unknown): RpcException {
    if (exception instanceof RpcException) {
      return exception;
    }

    if (exception instanceof HttpException) {
      return new RpcException({
        code: GrpcStatusCodeMapper.fromHttpToGrpc(exception.getStatus()),
        details: getHttpExceptionResponseMessage(exception),
      });
    }

    return new RpcException({
      code: status.UNKNOWN,
      details: exception?.['message'] ?? 'Unknown exception',
    });
  }
}
