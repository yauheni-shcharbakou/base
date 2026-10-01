import type { status } from '@grpc/grpc-js';

/**
 * The HTTP status each gRPC code stands for — the canonical mapping (google.rpc.Code). The one
 * table behind `GrpcStatusCodeMapper.fromGrpcToHttp` (@backend/grpc) and the admin's
 * `GrpcErrorMapper`. Several codes share a status, so it cannot be inverted: HTTP → gRPC is a table
 * of its own in @backend/grpc.
 *
 * Keyed by the numeric codes rather than `status.X`: this package reaches the browser through the
 * admin, and a value import of grpc-js would pull the Node client into that bundle. The codes are
 * fixed by the gRPC spec, and `Record<status, …>` makes the compiler demand exactly them.
 */
export const HTTP_STATUS_BY_GRPC_STATUS: Readonly<Record<status, number>> = {
  0: 200, // OK
  1: 499, // CANCELLED — "Client Closed Request", not an IANA status
  2: 500, // UNKNOWN
  3: 400, // INVALID_ARGUMENT
  4: 504, // DEADLINE_EXCEEDED
  5: 404, // NOT_FOUND
  6: 409, // ALREADY_EXISTS
  7: 403, // PERMISSION_DENIED
  8: 429, // RESOURCE_EXHAUSTED
  9: 400, // FAILED_PRECONDITION
  10: 409, // ABORTED
  11: 400, // OUT_OF_RANGE
  12: 501, // UNIMPLEMENTED
  13: 500, // INTERNAL
  14: 503, // UNAVAILABLE
  15: 500, // DATA_LOSS
  16: 401, // UNAUTHENTICATED
};
