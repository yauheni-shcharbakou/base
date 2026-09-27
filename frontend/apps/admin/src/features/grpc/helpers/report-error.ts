import { grpcErrorMapper } from '@/features/grpc/mappers';
import type { ActionError } from '@/features/grpc/types';

/**
 * What the browser may be told about a failure caught on the Next server — see `GrpcErrorMapper`.
 * A failure that is the server's (a 5xx, or no gRPC status at all) reaches the browser with a fixed
 * message, so it is logged here, the one place its own message is still seen.
 *
 * Server-only — it loads grpc-js — so it is imported by path, and this folder has no barrel for a
 * client module to reach it through.
 */
export const reportError = (error: unknown): ActionError => {
  const actionError = grpcErrorMapper.toActionError(error);

  if (actionError.statusCode >= 500) {
    console.error(error);
  }

  return actionError;
};
