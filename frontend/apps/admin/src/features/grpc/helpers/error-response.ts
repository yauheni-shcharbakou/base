import { reportError } from '@/features/grpc/helpers/report-error';
import { NextResponse } from 'next/server';

/**
 * A route handler's answer to an error it caught: the status and message `reportError` allows, as
 * `{ message }` — the body every `app/api` handler answers a failure with.
 *
 * Server-only, like `reportError`: imported by path, never through a barrel.
 */
export const errorResponse = (error: unknown): NextResponse => {
  const { message, statusCode } = reportError(error);
  return NextResponse.json({ message }, { status: statusCode });
};
