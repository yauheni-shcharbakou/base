import { Metadata, status as GrpcStatus, type ServiceError } from '@grpc/grpc-js';

/** A rejected gRPC call: an `Error` with the received status spread over it. */
export const isServiceError = (error: unknown): error is ServiceError => {
  return (
    error instanceof Error &&
    'code' in error &&
    'details' in error &&
    typeof error.code === 'number' &&
    typeof error.details === 'string'
  );
};

/**
 * A rejection the way grpc-js builds one. The Next server raises it for a call it refuses before
 * the gateway would — a status is what `GrpcErrorMapper` maps, where a plain `Error` is a 500.
 *
 * Server-only — it loads grpc-js — so it is imported by path, like every helper in this folder.
 */
export const createServiceError = (code: GrpcStatus, details: string): ServiceError => {
  return Object.assign(new Error(`${code} ${GrpcStatus[code]}: ${details}`), {
    code,
    details,
    metadata: new Metadata(),
  });
};
