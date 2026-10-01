import { authService } from '@/features/auth/services';
import { reportError } from '@/features/grpc/helpers/report-error';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Ends the session and answers with a redirect, so the browser loads the sign-in page as a new
 * document. A session must not end in a soft navigation: the page left behind keeps its queries
 * and their cache, asks once more without a session, and the 401 it caches is read again by the
 * next sign-in — whose session the auth provider then ends (ADR-0036).
 */
export async function POST(request: Request) {
  // A form on another site must not sign the admin out. Every browser that submits a form sends
  // the header; a client that does not is not a page.
  const site = request.headers.get('sec-fetch-site');

  if (site && site !== 'same-origin') {
    return NextResponse.json({ message: 'Cross-site sign-out refused' }, { status: 403 });
  }

  // `logout` already swallows a gateway failure; whatever else fails, the browser still leaves.
  await authService.logout().catch(reportError);

  // Relative: behind a proxy `request.url` names the host the server listens on, not the site's.
  return new Response(null, { status: 303, headers: { Location: '/login' } });
}
