import { reportError } from '@/features/grpc/helpers/report-error';
import type { ActionResult } from '@/features/grpc/types';

/**
 * Runs a server action's body and returns its outcome as a value — see `ActionResult`. The failure
 * goes through `reportError`, which withholds and logs what is the server's own.
 *
 * Server-only, like `reportError`: imported by path, never through a barrel.
 */
export const runAction = async <T>(body: () => Promise<T>): Promise<ActionResult<T>> => {
  try {
    return { ok: true, value: await body() };
  } catch (error) {
    return { ok: false, error: reportError(error) };
  }
};
