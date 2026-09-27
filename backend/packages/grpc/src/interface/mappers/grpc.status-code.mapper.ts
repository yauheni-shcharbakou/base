import { status } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
import { HTTP_STATUS_BY_GRPC_STATUS } from '@packages/common';

// "Client Closed Request": the canonical pair of CANCELLED. Not an IANA status, so Nest's
// `HttpStatus` has no member for it.
const CLIENT_CLOSED_REQUEST = 499;

export class GrpcStatusCodeMapper {
  // gRPC → HTTP is the canonical table in @packages/common, shared with the admin. HTTP → gRPC is
  // its own table, one entry per status, because inverting the shared one let the later of two
  // codes win: every 500 went out as DATA_LOSS ("unrecoverable data loss"). Where the canonical
  // table pairs a status with several codes, the entry is the general one (400 → INVALID_ARGUMENT,
  // 500 → INTERNAL), and 409 is ALREADY_EXISTS because a `ConflictException` here reports a unique
  // violation. The rest are statuses Nest has an exception for, paired by meaning. A status missing
  // here is INTERNAL.
  private static readonly grpcStatusByHttpStatus: Map<number, status> = new Map([
    [HttpStatus.OK, status.OK],
    [HttpStatus.BAD_REQUEST, status.INVALID_ARGUMENT],
    [HttpStatus.UNAUTHORIZED, status.UNAUTHENTICATED],
    [HttpStatus.FORBIDDEN, status.PERMISSION_DENIED],
    [HttpStatus.NOT_FOUND, status.NOT_FOUND],
    [HttpStatus.METHOD_NOT_ALLOWED, status.UNIMPLEMENTED],
    [HttpStatus.REQUEST_TIMEOUT, status.DEADLINE_EXCEEDED],
    [HttpStatus.CONFLICT, status.ALREADY_EXISTS],
    [HttpStatus.GONE, status.NOT_FOUND],
    [HttpStatus.PRECONDITION_FAILED, status.FAILED_PRECONDITION],
    // gRPC's own answer to a message over the size limit.
    [HttpStatus.PAYLOAD_TOO_LARGE, status.RESOURCE_EXHAUSTED],
    [HttpStatus.UNPROCESSABLE_ENTITY, status.INVALID_ARGUMENT],
    [HttpStatus.PRECONDITION_REQUIRED, status.FAILED_PRECONDITION],
    [HttpStatus.TOO_MANY_REQUESTS, status.RESOURCE_EXHAUSTED],
    [CLIENT_CLOSED_REQUEST, status.CANCELLED],
    [HttpStatus.INTERNAL_SERVER_ERROR, status.INTERNAL],
    [HttpStatus.NOT_IMPLEMENTED, status.UNIMPLEMENTED],
    // The upstream answered with something unusable: a failure to reach a working service.
    [HttpStatus.BAD_GATEWAY, status.UNAVAILABLE],
    [HttpStatus.SERVICE_UNAVAILABLE, status.UNAVAILABLE],
    [HttpStatus.GATEWAY_TIMEOUT, status.DEADLINE_EXCEEDED],
  ]);

  static fromGrpcToHttp(grpcStatus?: status): number {
    return HTTP_STATUS_BY_GRPC_STATUS[grpcStatus] ?? HttpStatus.INTERNAL_SERVER_ERROR;
  }

  static fromHttpToGrpc(httpStatus?: number): status {
    return this.grpcStatusByHttpStatus.get(httpStatus) ?? status.INTERNAL;
  }
}
