import { isServiceError } from '@/features/grpc/helpers/service-error';
import type { ActionError } from '@/features/grpc/types';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { HTTP_STATUS_BY_GRPC_STATUS } from '@packages/common';

// The canonical gRPC → HTTP table, shared with @backend/grpc. OK never rejects a call, so an error
// claiming it is no status at all.
const getStatusCode = (error: unknown): number => {
  if (!isServiceError(error) || error.code === GrpcStatus.OK) {
    return 500;
  }

  return HTTP_STATUS_BY_GRPC_STATUS[error.code] ?? 500;
};

// The gateway's `retry-after` trailer on a call its rate limit refused: whole seconds.
const RETRY_AFTER_METADATA_KEY = 'retry-after';

const getRetryAfterMs = (error: unknown): number | undefined => {
  const seconds = isServiceError(error)
    ? Number(error.metadata?.get(RETRY_AFTER_METADATA_KEY)[0])
    : NaN;

  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
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
   * reach into `details`, and a plain error may be anything the server tripped over. A call the
   * gateway's rate limit refused also says how long to wait (`retryAfterMs`).
   */
  toActionError(error: unknown): ActionError {
    const statusCode = getStatusCode(error);
    const retryAfterMs = getRetryAfterMs(error);
    const message =
      statusCode < 500 && isServiceError(error) && error.details
        ? error.details
        : getFallbackMessage(statusCode);

    return retryAfterMs ? { message, statusCode, retryAfterMs } : { message, statusCode };
  }
}
