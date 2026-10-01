import type { ActionResult } from '@/features/grpc/types';

/**
 * The client half of `ActionResult`: the value, or the failure thrown again. The thrown error has
 * the `message` and `statusCode` Refine reads off an `HttpError` for its notifications and forms,
 * and is still an `Error`, so `getErrorMessage` reads it like any other — with `retryAfterMs` when
 * the gateway's rate limit refused the call.
 */
export const unwrapActionResult = <T>(result: ActionResult<T>): T => {
  if (!result.ok) {
    const { message, ...rest } = result.error;
    throw Object.assign(new Error(message), rest);
  }

  return result.value;
};
