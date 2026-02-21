import { HttpExceptionMapper } from '@backend/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { HttpException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import _ from 'lodash';
import { GrpcStatusCodeMapper } from 'grpc/mappers/grpc.status-code.mapper';

export class GrpcExceptionMapper {
  static getMessage(exception: RpcException): string {
    const error = exception.getError();
    return _.isString(error) ? error : error['details'] || 'Unknown exception';
  }

  static getStatus(exception: RpcException): GrpcStatus {
    const error = exception.getError();
    return error['code'] || GrpcStatus.UNKNOWN;
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

    return new RpcException({
      code: GrpcStatus.UNKNOWN,
      details: exception?.['message'] ?? 'Unknown exception',
    });
  }
}
