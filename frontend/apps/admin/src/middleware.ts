import { authService } from '@/features/auth/services';
import { AUTH_COOKIE_NAMES } from '@/features/auth/services/auth.service';
import { reportError } from '@/features/grpc/helpers/report-error';
import { isServiceError } from '@/features/grpc/helpers/service-error';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { NextResponse, type NextRequest } from 'next/server';

// Passes the request on with the cookies set on it, so the render or action it reaches reads them.
const forward = (request: NextRequest) => {
  return NextResponse.next({ request: { headers: request.headers } });
};

/**
 * Refreshes an expired session before the request renders. A server component may read cookies
 * but not write them, so a refresh inside the page's own `checkAccess` reached the gateway and then
 * threw on the cookie write — and a valid refresh token was sent to `/login`. Here the new cookies
 * go on the request, for this render, and on the response, for the browser.
 */
export async function middleware(request: NextRequest) {
  const refreshToken = request.cookies.get('refresh-token')?.value;

  if (!refreshToken || request.cookies.has('access-token')) {
    return NextResponse.next();
  }

  try {
    const authData = await authService.refreshSession(refreshToken, request.headers);
    const authCookies = authService.getAuthCookies(authData);

    authCookies.forEach(({ name, value }) => request.cookies.set(name, value));

    const response = forward(request);
    authCookies.forEach((cookie) => response.cookies.set(cookie));

    return response;
  } catch (error) {
    reportError(error);

    // The gateway refused the token, or the user is no admin: the session is over, and a cookie
    // left behind would spend a rate-limited refresh on every request until it expired.
    if (
      isServiceError(error) &&
      (error.code === GrpcStatus.UNAUTHENTICATED || error.code === GrpcStatus.PERMISSION_DENIED)
    ) {
      AUTH_COOKIE_NAMES.forEach((name) => request.cookies.delete(name));

      const response = forward(request);
      AUTH_COOKIE_NAMES.forEach((name) => response.cookies.delete({ name, path: '/' }));

      return response;
    }

    // Anything else — the gateway down (logged by `reportError`), a rate limit — keeps the cookies
    // for the next request to try again; this one renders as signed out.
    return NextResponse.next();
  }
}

export const config = {
  // grpc-js is a Node client.
  runtime: 'nodejs',
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
