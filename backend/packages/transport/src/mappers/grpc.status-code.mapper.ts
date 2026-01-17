import { status } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
import _ from 'lodash';

export class GrpcStatusCodeMapper {
  private static readonly httpStatusByGrpcStatus: Map<status, HttpStatus> = new Map([
    [status.OK, HttpStatus.OK],
    [status.CANCELLED, HttpStatus.METHOD_NOT_ALLOWED],
    [status.UNKNOWN, HttpStatus.BAD_GATEWAY],
    [status.INVALID_ARGUMENT, HttpStatus.BAD_REQUEST],
    [status.DEADLINE_EXCEEDED, HttpStatus.REQUEST_TIMEOUT],
    [status.NOT_FOUND, HttpStatus.NOT_FOUND],
    [status.ALREADY_EXISTS, HttpStatus.CONFLICT],
    [status.PERMISSION_DENIED, HttpStatus.FORBIDDEN],
    [status.RESOURCE_EXHAUSTED, HttpStatus.TOO_MANY_REQUESTS],
    [status.FAILED_PRECONDITION, HttpStatus.PRECONDITION_REQUIRED],
    [status.ABORTED, HttpStatus.METHOD_NOT_ALLOWED],
    [status.OUT_OF_RANGE, HttpStatus.PAYLOAD_TOO_LARGE],
    [status.UNIMPLEMENTED, HttpStatus.NOT_IMPLEMENTED],
    [status.INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR],
    [status.UNAVAILABLE, HttpStatus.NOT_FOUND],
    [status.DATA_LOSS, HttpStatus.INTERNAL_SERVER_ERROR],
    [status.UNAUTHENTICATED, HttpStatus.UNAUTHORIZED],
  ]);

  private static readonly grpcStatusByHttpStatus: Map<HttpStatus, status> = new Map(
    _.map([...this.httpStatusByGrpcStatus.entries()], ([grpcStatus, httpStatus]) => [
      httpStatus,
      +grpcStatus,
    ]),
  );

  static fromGrpcToHttp(grpcStatus?: status): HttpStatus {
    return this.httpStatusByGrpcStatus.get(grpcStatus) ?? HttpStatus.INTERNAL_SERVER_ERROR;
  }

  static fromHttpToGrpc(httpStatus?: HttpStatus): status {
    return this.grpcStatusByHttpStatus.get(httpStatus) ?? status.INTERNAL;
  }
}
