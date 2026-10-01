import { createServiceError, isServiceError } from '@/features/grpc/helpers/service-error';
import { status as GrpcStatus } from '@grpc/grpc-js';

// The auth service refuses a refresh token it cannot verify with PERMISSION_DENIED, and one whose
// user is gone with NOT_FOUND. To the admin either is the same as having no token at all.
const SESSION_ENDED_CODES = new Set<GrpcStatus>([
  GrpcStatus.UNAUTHENTICATED,
  GrpcStatus.PERMISSION_DENIED,
  GrpcStatus.NOT_FOUND,
]);

/**
 * A signed-out session: no refresh token, or one the gateway refused. It is UNAUTHENTICATED — a 401
 * the auth provider reads as logged out — never a plain `Error`, which `runAction` reports as a 500.
 *
 * Server-only — it loads grpc-js — so it is imported by path.
 */
export const sessionEndedError = (details: string) => {
  return createServiceError(GrpcStatus.UNAUTHENTICATED, details);
};

/**
 * The failure of a refresh as the admin reports it: a refused token ends the session, anything else
 * (the gateway down, a rate limit) stays what it was.
 */
export const toRefreshError = (error: unknown): unknown => {
  if (isServiceError(error) && SESSION_ENDED_CODES.has(error.code)) {
    return sessionEndedError(error.details);
  }

  return error;
};
