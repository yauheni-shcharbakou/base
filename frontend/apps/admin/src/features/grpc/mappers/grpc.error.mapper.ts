import type { ActionError } from '@/features/grpc/types';
import { status as GrpcStatus, type ServiceError } from '@grpc/grpc-js';
import { HTTP_STATUS_BY_GRPC_STATUS } from '@packages/common';

const isServiceError = (error: unknown): error is ServiceError => {
  return (
    error instanceof Error &&
    'code' in error &&
    'details' in error &&
    typeof error.code === 'number' &&
    typeof error.details === 'string'
  );
};

// The canonical gRPC → HTTP table, shared with @backend/grpc. OK never rejects a call, so an error
// claiming it is no status at all.
const getStatusCode = (error: unknown): number => {
  if (!isServiceError(error) || error.code === GrpcStatus.OK) {
    return 500;
  }

  return HTTP_STATUS_BY_GRPC_STATUS[error.code] ?? 500;
};

// Shown in place of a message the page does not get: withheld, or never written.
const getFallbackMessage = (statusCode: number): string => {
  switch (statusCode) {
    case 503:
      return 'The service is unavailable, try again later';
    case 504:
      return 'The request timed out';
    default:
      return statusCode < 500 ? 'The request failed' : 'Internal server error';
  }
};

export class GrpcErrorMapper {
  /**
   * A 4xx keeps the callee's own message: it says what was wrong with the request, and the backend
   * wrote it for the caller. Anything else — a 5xx, or an error with no gRPC status at all — gets a
   * fixed one, because its own is not the page's to show: grpc-js puts the address it failed to
   * reach into `details`, and a plain error may be anything the server tripped over.
   */
  toActionError(error: unknown): ActionError {
    const statusCode = getStatusCode(error);

    if (statusCode < 500 && isServiceError(error) && error.details) {
      return { message: error.details, statusCode };
    }

    return { message: getFallbackMessage(statusCode), statusCode };
  }
}
