import { status as GrpcStatus } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
import { GrpcStatusCodeMapper } from './grpc.status-code.mapper';

describe('GrpcStatusCodeMapper', () => {
  describe('fromGrpcToHttp', () => {
    // The canonical table (google.rpc.Code), in full: every client of the gateway reads it.
    it.each([
      [GrpcStatus.OK, HttpStatus.OK],
      [GrpcStatus.CANCELLED, 499],
      [GrpcStatus.UNKNOWN, HttpStatus.INTERNAL_SERVER_ERROR],
      [GrpcStatus.INVALID_ARGUMENT, HttpStatus.BAD_REQUEST],
      [GrpcStatus.DEADLINE_EXCEEDED, HttpStatus.GATEWAY_TIMEOUT],
      [GrpcStatus.NOT_FOUND, HttpStatus.NOT_FOUND],
      [GrpcStatus.ALREADY_EXISTS, HttpStatus.CONFLICT],
      [GrpcStatus.PERMISSION_DENIED, HttpStatus.FORBIDDEN],
      [GrpcStatus.RESOURCE_EXHAUSTED, HttpStatus.TOO_MANY_REQUESTS],
      [GrpcStatus.FAILED_PRECONDITION, HttpStatus.BAD_REQUEST],
      [GrpcStatus.ABORTED, HttpStatus.CONFLICT],
      [GrpcStatus.OUT_OF_RANGE, HttpStatus.BAD_REQUEST],
      [GrpcStatus.UNIMPLEMENTED, HttpStatus.NOT_IMPLEMENTED],
      [GrpcStatus.INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR],
      [GrpcStatus.UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE],
      [GrpcStatus.DATA_LOSS, HttpStatus.INTERNAL_SERVER_ERROR],
      [GrpcStatus.UNAUTHENTICATED, HttpStatus.UNAUTHORIZED],
    ])('maps gRPC %i to %i', (grpcStatus, httpStatus) => {
      expect(GrpcStatusCodeMapper.fromGrpcToHttp(grpcStatus)).toBe(httpStatus);
    });

    it('maps an unknown code to 500', () => {
      expect(GrpcStatusCodeMapper.fromGrpcToHttp(99 as GrpcStatus)).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe('fromHttpToGrpc', () => {
    it.each([
      [HttpStatus.OK, GrpcStatus.OK],
      [HttpStatus.BAD_REQUEST, GrpcStatus.INVALID_ARGUMENT],
      [HttpStatus.UNAUTHORIZED, GrpcStatus.UNAUTHENTICATED],
      [HttpStatus.FORBIDDEN, GrpcStatus.PERMISSION_DENIED],
      // A missing record once went out as UNAVAILABLE — the code a client also gets when the
      // server is down — because UNAVAILABLE was paired with 404 in an inverted table.
      [HttpStatus.NOT_FOUND, GrpcStatus.NOT_FOUND],
      [HttpStatus.METHOD_NOT_ALLOWED, GrpcStatus.UNIMPLEMENTED],
      [HttpStatus.REQUEST_TIMEOUT, GrpcStatus.DEADLINE_EXCEEDED],
      [HttpStatus.CONFLICT, GrpcStatus.ALREADY_EXISTS],
      [HttpStatus.GONE, GrpcStatus.NOT_FOUND],
      [HttpStatus.PRECONDITION_FAILED, GrpcStatus.FAILED_PRECONDITION],
      [HttpStatus.PAYLOAD_TOO_LARGE, GrpcStatus.RESOURCE_EXHAUSTED],
      [HttpStatus.UNPROCESSABLE_ENTITY, GrpcStatus.INVALID_ARGUMENT],
      [HttpStatus.PRECONDITION_REQUIRED, GrpcStatus.FAILED_PRECONDITION],
      [HttpStatus.TOO_MANY_REQUESTS, GrpcStatus.RESOURCE_EXHAUSTED],
      [499, GrpcStatus.CANCELLED],
      // Not DATA_LOSS, which the inverted table used to pick.
      [HttpStatus.INTERNAL_SERVER_ERROR, GrpcStatus.INTERNAL],
      [HttpStatus.NOT_IMPLEMENTED, GrpcStatus.UNIMPLEMENTED],
      [HttpStatus.BAD_GATEWAY, GrpcStatus.UNAVAILABLE],
      [HttpStatus.SERVICE_UNAVAILABLE, GrpcStatus.UNAVAILABLE],
      [HttpStatus.GATEWAY_TIMEOUT, GrpcStatus.DEADLINE_EXCEEDED],
    ])('sends %i as gRPC %i', (httpStatus, grpcStatus) => {
      expect(GrpcStatusCodeMapper.fromHttpToGrpc(httpStatus)).toBe(grpcStatus);
    });

    it('sends a status the table does not list as INTERNAL', () => {
      expect(GrpcStatusCodeMapper.fromHttpToGrpc(HttpStatus.I_AM_A_TEAPOT)).toBe(
        GrpcStatus.INTERNAL,
      );
      expect(GrpcStatusCodeMapper.fromHttpToGrpc(undefined)).toBe(GrpcStatus.INTERNAL);
    });
  });

  // The two tables agree: a code sent out as HTTP comes back as itself. The exceptions are the
  // codes that share their HTTP status with a more general one, listed so that a new pair which
  // breaks the round trip fails here instead of changing what an exception goes out as.
  it('round-trips every gRPC code except the ones that share an HTTP status', () => {
    const codes = Object.values(GrpcStatus).filter(
      (code): code is GrpcStatus => typeof code === 'number',
    );

    const mismatches = codes.filter(
      (code) =>
        GrpcStatusCodeMapper.fromHttpToGrpc(GrpcStatusCodeMapper.fromGrpcToHttp(code)) !== code,
    );

    expect(mismatches.sort((a, b) => a - b)).toEqual([
      GrpcStatus.UNKNOWN,
      GrpcStatus.FAILED_PRECONDITION,
      GrpcStatus.ABORTED,
      GrpcStatus.OUT_OF_RANGE,
      GrpcStatus.DATA_LOSS,
    ]);
  });
});
