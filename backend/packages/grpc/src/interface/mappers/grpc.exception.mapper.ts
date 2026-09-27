import { HttpExceptionMapper } from '@backend/common';
import { status as GrpcStatus, type ServiceError } from '@grpc/grpc-js';
import { HttpException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import _ from 'lodash';
import { GrpcStatusCodeMapper } from './grpc.status-code.mapper';

export class GrpcExceptionMapper {
  static getMessage(exception: RpcException): string {
    const error = exception.getError();
    return _.isString(error)
      ? error
      : (error['details'] as string)?.toString() || 'Unknown exception';
  }

  static getStatus(exception: RpcException): GrpcStatus {
    const error = exception.getError();
    return (error['code'] as GrpcStatus) || GrpcStatus.UNKNOWN;
  }

  static toHttpException(exception: RpcException): HttpException {
    return new HttpException(
      this.getMessage(exception),
      GrpcStatusCodeMapper.fromGrpcToHttp(this.getStatus(exception)),
    );
  }

  static toRpcException(exception: unknown): RpcException {
    if (exception instanceof RpcException) {
      return exception;
    }

    if (exception instanceof HttpException) {
      return new RpcException({
        code: GrpcStatusCodeMapper.fromHttpToGrpc(exception.getStatus()),
        details: HttpExceptionMapper.getMessage(exception),
      });
    }

    // A failed outbound call: grpc-js rejects with the status the callee sent, and it goes on as is.
    // Wrapped as UNKNOWN, the callee's status would be lost to every client of the gateway.
    if (this.isServiceError(exception)) {
      return new RpcException({ code: exception.code, details: exception.details });
    }

    return new RpcException({
      code: GrpcStatus.UNKNOWN,
      details: exception?.['message'] ?? 'Unknown exception',
    });
  }

  private static isServiceError(exception: unknown): exception is ServiceError {
    return (
      exception instanceof Error &&
      'code' in exception &&
      'details' in exception &&
      _.isNumber(exception.code) &&
      _.isString(exception.details)
    );
  }
}
